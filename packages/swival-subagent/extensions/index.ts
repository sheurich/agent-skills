/**
 * Swival Subagent Tool — delegate tasks to swival with its reviewer loop.
 *
 * Spawns a separate `swival` process for each invocation. Unlike pi's
 * built-in subagent extension which shares a JSON streaming protocol,
 * swival has no structured event stream: diagnostics go to stderr,
 * final answer to stdout, and structured metadata to a `--report` JSON
 * file on exit.
 *
 * Modes:
 *   - Single:   { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain:    { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *               Each step's task may reference `{previous}` which is
 *               substituted with the prior step's final answer before
 *               dispatch. The chain stops on the first failing step
 *               (non-zero exit, or outcome is "failed" or "error").
 *
 * Swival agents live in ~/.pi/agent/swival-agents/ (user) and
 * .pi/swival-agents/ (project). Their frontmatter schema extends the
 * pi-subagent schema with swival-specific fields (selfReview, reviewer,
 * verify, sandbox, files, commands, etc.). See agents.ts.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { StringEnum } from "@mariozechner/pi-ai";
import { type ExtensionAPI, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "typebox";
import {
	type AgentScope,
	discoverSwivalAgents,
	type SwivalAgentConfig,
} from "./agents.js";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const STDERR_TAIL_LINES = 30;
const STDOUT_TAIL_CHARS = 4000;

// -------------------------------------------------------------- helpers --

function stripAnsi(s: string): string {
	// Remove CSI / OSC / SGR sequences. Not exhaustive but covers swival's output.
	return s.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "");
}

function tail<T>(arr: T[], n: number): T[] {
	return arr.length > n ? arr.slice(arr.length - n) : arr;
}

/**
 * A run is considered a failure if swival exited non-zero OR the report
 * recorded a non-success outcome. Reviewer rejection and AgentError
 * subclasses can produce `outcome: "failed" | "error"` with exit 0
 * (e.g. review budget exhausted but the CLI itself completed fine).
 * `outcome: "unknown"` — from a missing or malformed report — is NOT
 * treated as failure so a misconfigured report flag doesn't mask a
 * successful run.
 */
export function isRunFailure(r: { exitCode: number; report?: { outcome?: string } }): boolean {
	if (r.exitCode !== 0) return true;
	const o = r.report?.outcome;
	return o === "failed" || o === "error";
}

/**
 * Dispatch-time overrides that outrank frontmatter for a single call.
 * All fields are optional; undefined means "use the agent's frontmatter value".
 */
export interface SwivalOverrides {
	model?: string;
	profile?: string;
	provider?: string;
	baseUrl?: string;
	selfReview?: boolean;
	reviewer?: string;
	reviewPrompt?: string;
	maxReviewRounds?: number;
	temperature?: number;
	topP?: number;
	seed?: number;
	reasoningEffort?: string;
	maxOutputTokens?: number;
	maxTurns?: number;
	cache?: boolean;
	cacheDir?: string;
	traceDir?: string;
	verify?: string;
	encryptSecrets?: boolean;
}

export function buildSwivalArgs(
	agent: SwivalAgentConfig,
	reportPath: string,
	cwd: string | undefined,
	overrides: SwivalOverrides = {},
): string[] {
	const args: string[] = [];

	// Nested-invocation hygiene: default to disabling lifecycle / MCP / A2A /
	// history / continue / memory / subagents unless the agent explicitly opts
	// in (field=false). --no-subagents prevents a nested swival from spawning
	// its own sub-subagents (unbounded recursion risk).
	if (agent.noLifecycle !== false) args.push("--no-lifecycle");
	if (agent.noMcp !== false) args.push("--no-mcp");
	if (agent.noA2a !== false) args.push("--no-a2a");
	if (agent.noHistory !== false) args.push("--no-history");
	if (agent.noContinue !== false) args.push("--no-continue");
	if (agent.noMemory !== false) args.push("--no-memory");
	if (agent.noSubagents !== false) args.push("--no-subagents");

	// Provider / model (overrides outrank frontmatter)
	const provider = overrides.provider ?? agent.provider;
	if (provider) args.push("--provider", provider);
	const profile = overrides.profile ?? agent.profile;
	if (profile) args.push("--profile", profile);
	const model = overrides.model ?? agent.model;
	if (model) args.push("--model", model);
	const baseUrl = overrides.baseUrl ?? agent.baseUrl;
	if (baseUrl) args.push("--base-url", baseUrl);

	// Sampling / limits
	const temperature = overrides.temperature ?? agent.temperature;
	if (temperature !== undefined) args.push("--temperature", String(temperature));
	const topP = overrides.topP ?? agent.topP;
	if (topP !== undefined) args.push("--top-p", String(topP));
	const seed = overrides.seed ?? agent.seed;
	if (seed !== undefined) args.push("--seed", String(seed));
	const reasoningEffort = overrides.reasoningEffort ?? agent.reasoningEffort;
	if (reasoningEffort) args.push("--reasoning-effort", reasoningEffort);
	const maxOutputTokens = overrides.maxOutputTokens ?? agent.maxOutputTokens;
	if (maxOutputTokens !== undefined) args.push("--max-output-tokens", String(maxOutputTokens));
	const maxTurns = overrides.maxTurns ?? agent.maxTurns;
	if (maxTurns !== undefined) args.push("--max-turns", String(maxTurns));

	// Caching
	const cache = overrides.cache ?? agent.cache;
	if (cache) args.push("--cache");
	const cacheDir = overrides.cacheDir ?? agent.cacheDir;
	if (cacheDir) args.push("--cache-dir", cacheDir);

	// Context management / retry budget (swival 1.0.12+)
	if (agent.proactiveSummaries) args.push("--proactive-summaries");
	if (agent.retries !== undefined) args.push("--retries", String(agent.retries));

	// Reviewer loop — --self-review and --reviewer are mutually exclusive in
	// swival's argparse (hard crash: "cannot be used together"). When
	// selfReview is truthy, skip --reviewer even if the agent sets one.
	const selfReview = overrides.selfReview ?? agent.selfReview;
	const reviewer = overrides.reviewer ?? agent.reviewer;
	if (selfReview) {
		args.push("--self-review");
	} else if (reviewer) {
		args.push("--reviewer", reviewer);
	}
	const reviewPrompt = overrides.reviewPrompt ?? agent.reviewPrompt;
	if (reviewPrompt) args.push("--review-prompt", reviewPrompt);
	const verify = overrides.verify ?? agent.verify;
	if (verify) args.push("--verify", verify);
	const maxReviewRounds = overrides.maxReviewRounds ?? agent.maxReviewRounds;
	if (maxReviewRounds !== undefined) args.push("--max-review-rounds", String(maxReviewRounds));

	// Sandbox / commands
	if (agent.yolo) {
		args.push("--yolo");
	} else {
		if (agent.sandbox) args.push("--sandbox", agent.sandbox);
		if (agent.files) args.push("--files", agent.files);
		if (agent.commands) args.push("--commands", agent.commands);
	}
	// AgentFS session controls (only meaningful with --sandbox agentfs; we pass
	// them through regardless and let swival's argparse reject bad combinations).
	if (agent.sandboxSession) args.push("--sandbox-session", agent.sandboxSession);
	if (agent.sandboxStrictRead) args.push("--sandbox-strict-read");
	if (agent.noSandboxAutoSession) args.push("--no-sandbox-auto-session");
	if (agent.baseDir) args.push("--base-dir", agent.baseDir);
	else if (cwd) args.push("--base-dir", cwd);
	for (const d of agent.addDir ?? []) args.push("--add-dir", d);
	for (const d of agent.addDirRo ?? []) args.push("--add-dir-ro", d);
	const encryptSecrets = overrides.encryptSecrets ?? agent.encryptSecrets;
	if (encryptSecrets) args.push("--encrypt-secrets");
	if (agent.noReadGuard) args.push("--no-read-guard");

	// Prompt / memory (noMemory is handled above in nested-invocation hygiene)
	if (agent.noInstructions) args.push("--no-instructions");
	if (agent.noSkills) args.push("--no-skills");

	// Output shape: we want stdout to carry the final answer.
	// --no-color keeps stderr clean for forwarding to Pi's UI.
	args.push("--no-color");
	if (agent.quiet) args.push("-q");

	args.push("--report", reportPath);
	if (overrides.traceDir) args.push("--trace-dir", overrides.traceDir);

	// Agent system prompt (body of the .md). Pass as --system-prompt
	// argv; node's spawn handles long argv up to the platform ARG_MAX.
	if (agent.systemPrompt.trim()) {
		args.push("--system-prompt", agent.systemPrompt);
	}

	// Escape hatch
	for (const a of agent.extraArgs ?? []) args.push(a);

	return args;
}

// --------------------------------------------------------------- types --

/**
 * Subset of the swival `--report` JSON schema (version 1) that we surface.
 * Unknown / missing fields are tolerated; consumers must null-check.
 *
 * Tracked against swival 1.0.14. Known `outcome` values are "success",
 * "failed" (reviewer rejected), and "error" (an AgentError was raised:
 * ConfigError, ContextOverflowError, ToolsNotSupportedError, or
 * LifecycleError). For error outcomes, `result.error_message` carries
 * the exception string.
 *
 * Example minimal report:
 *   {
 *     "version": 1,
 *     "result": { "outcome": "success" | "failed" | "error",
 *                 "answer": "...final answer...",
 *                 "exit_code": 0,
 *                 "error_message": "context window exceeded (typed)" },
 *     "stats":  { "turns": 4, "review_rounds": 3, "tool_calls_total": 8,
 *                 "tool_calls_by_name": { "read_file": {succeeded:5,failed:0} },
 *                 "total_llm_time_s": 12.4, "total_tool_time_s": 0.1,
 *                 "llm_calls": 9, "compactions": 0 },
 *     "timeline": [
 *       { "type": "llm_call", ... },
 *       { "type": "review", "round": 1, "exit_code": 1, "feedback": "..." }
 *     ]
 *   }
 */
interface ReportSummary {
	// From stats.review_rounds — number of reviewer retry rounds that ran.
	reviewRounds?: number;
	// Derived from result.outcome. "success" means reviewer accepted (or
	// review was disabled and swival returned a terminal answer). "failed"
	// is a reviewer rejection. "error" is an internal AgentError (see
	// errorMessage for the specific cause).
	outcome?: "success" | "failed" | "error" | "unknown";
	accepted?: boolean;
	// From result.error_message — populated when swival raised an AgentError
	// subclass (ConfigError, ContextOverflowError, ToolsNotSupportedError,
	// LifecycleError). Prefer this over stderr-tail classification when present.
	errorMessage?: string;
	// From stats.turns — number of agent-loop iterations actually executed.
	turns?: number;
	// Tool usage stats (no token/cost totals in the report schema).
	toolCallsTotal?: number;
	toolCallsByName?: Record<string, { succeeded?: number; failed?: number }>;
	// Wall-clock breakdown for the session.
	totalLlmTimeS?: number;
	totalToolTimeS?: number;
	llmCalls?: number;
	compactions?: number;
	// Last reviewer feedback (populated from timeline[] when a review rejected).
	lastReviewFeedback?: string;
	// Final answer, if result.answer is present in the report.
	answer?: string;
	// Model / provider recorded by swival.
	model?: string;
	provider?: string;
	raw?: Record<string, unknown>;
}

/**
 * Lightweight view of a single trace event we care to render.
 * Swival emits one HuggingFace-compatible JSON object per line under
 * `--trace-dir/<sessionId>.jsonl`; we only extract tool calls and
 * assistant text for Pi's UI.
 */
export interface TraceToolCall {
	type: "toolCall";
	name: string;
	args: Record<string, unknown>;
	ok?: boolean; // set when a matching tool_result arrives
}
export interface TraceText {
	type: "text";
	text: string;
}
export type TraceEvent = TraceToolCall | TraceText;

interface SwivalResult {
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	exitCode: number; // -1 still running, 0 ok, >0 failure
	finalOutput: string;
	stderrTail: string[];
	durationMs: number;
	report?: ReportSummary;
	errorMessage?: string;
	// Populated from --trace-dir JSONL when we can tail it.
	traceEvents?: TraceEvent[];
}

interface SwivalDetails {
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SwivalResult[];
}

type OnUpdateCallback = (partial: AgentToolResult<SwivalDetails>) => void;

// ---------------------------------------------------------- report read --

const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const toStr = (v: unknown) => (typeof v === "string" ? v : undefined);

export function summarizeReport(raw: Record<string, unknown>): ReportSummary {
	// Schema version 1 (see swival/report.py). We tolerate missing fields
	// but use the documented keys as the authoritative source.
	const stats = (raw.stats ?? {}) as Record<string, unknown>;
	const result = (raw.result ?? {}) as Record<string, unknown>;
	const timelineRaw = Array.isArray(raw.timeline) ? (raw.timeline as Array<Record<string, unknown>>) : [];

	const outcomeVal = toStr(result.outcome);
	let outcome: ReportSummary["outcome"] = "unknown";
	if (outcomeVal === "success") outcome = "success";
	else if (outcomeVal === "failed") outcome = "failed";
	else if (outcomeVal === "error") outcome = "error";

	// Last reviewer feedback: the most recent timeline entry of type "review".
	// We include its feedback even on accepted runs (for visibility), but
	// only surface it by default on rejections.
	let lastReviewFeedback: string | undefined;
	for (let i = timelineRaw.length - 1; i >= 0; i--) {
		const entry = timelineRaw[i];
		if (entry?.type === "review") {
			const fb = toStr(entry.feedback);
			if (fb && fb.trim()) {
				lastReviewFeedback = fb.trim();
				break;
			}
		}
	}

	return {
		reviewRounds: toNum(stats.review_rounds),
		outcome,
		accepted: outcome === "success" ? true : outcome === "failed" || outcome === "error" ? false : undefined,
		errorMessage: toStr(result.error_message),
		turns: toNum(stats.turns),
		toolCallsTotal: toNum(stats.tool_calls_total),
		toolCallsByName: validateToolCallsByName(stats.tool_calls_by_name),
		totalLlmTimeS: toNum(stats.total_llm_time_s),
		totalToolTimeS: toNum(stats.total_tool_time_s),
		llmCalls: toNum(stats.llm_calls),
		compactions: toNum(stats.compactions),
		lastReviewFeedback,
		answer: toStr(result.answer),
		model: toStr(raw.model),
		provider: toStr(raw.provider),
		raw,
	};
}

function validateToolCallsByName(
	raw: unknown,
): ReportSummary["toolCallsByName"] {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
	const out: Record<string, { succeeded?: number; failed?: number }> = {};
	for (const [name, val] of Object.entries(raw as Record<string, unknown>)) {
		if (!val || typeof val !== "object" || Array.isArray(val)) continue;
		const v = val as Record<string, unknown>;
		const succeeded = toNum(v.succeeded);
		const failed = toNum(v.failed);
		if (succeeded !== undefined || failed !== undefined) {
			out[name] = { succeeded, failed };
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

async function readReport(reportPath: string): Promise<ReportSummary | undefined> {
	try {
		const txt = await fs.promises.readFile(reportPath, "utf-8");
		const parsed = JSON.parse(txt) as Record<string, unknown>;
		return summarizeReport(parsed);
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------- error classify --

/**
 * Map a noisy stderr tail (plus the report summary, if any) onto a short,
 * human-friendly error headline. Pi surfaces `errorMessage` in the failure
 * banner, so keeping it concise makes for a better UX than dumping the
 * entire traceback.
 *
 * When the report carries a typed `result.error_message` (swival 1.0.14+
 * writes one whenever an AgentError subclass is raised), we prefer that
 * over the stderr heuristics below since it's the authoritative cause.
 *
 * Patterns we recognise today:
 *   - AWS SSO session expired / credentials missing
 *   - HTTP 401 / 403 from the LLM provider
 *   - DNS / connection refused to the LLM endpoint (e.g. proxy down)
 *   - Rate limit (429)
 *   - ConfigError (unknown provider / missing model / bad API key)
 *   - ContextOverflowError (context window exceeded; 1.0.14 recovers when
 *     it can, but surfaces this when retries at 50/25/10% all fail)
 *   - ToolsNotSupportedError (model lacks function calling)
 *   - LifecycleError (lifecycle hook failed in fail-closed mode)
 *   - Review-round budget exhausted
 *   - ARG_MAX from oversized system prompt
 */
export function classifyFailure(
	stderrLines: readonly string[],
	report?: ReportSummary,
): string | undefined {
	// Review budget exhausted is usually success-from-swival-cli's POV (exit 0)
	// but outcome=failed in the report. We surface it specifically so the
	// caller knows *why* the run is marked failed rather than showing stderr.
	if (report?.outcome === "failed" && typeof report.reviewRounds === "number" && report.reviewRounds > 0) {
		return `Reviewer rejected after ${report.reviewRounds} round${report.reviewRounds === 1 ? "" : "s"}. See 'reviewer feedback' below.`;
	}

	// Prefer the authoritative error_message from the report when swival
	// finalized one (outcome="error" implies an AgentError subclass was raised).
	// We normalise the most common subclasses into a short headline but fall
	// back to the raw message when we don't have a specific pattern.
	const reportMsg = report?.errorMessage?.trim();
	if (reportMsg) {
		if (/context window exceeded|contextoverflow/i.test(reportMsg))
			return `Context window exceeded — ${reportMsg}`;
		if (/does not support (?:chat completions with tools|function calling)|toolsnotsupported/i.test(reportMsg))
			return `Model does not support function calling — ${reportMsg}`;
		if (/lifecycle.*hook failed|lifecycleerror/i.test(reportMsg))
			return `Lifecycle hook failed — ${reportMsg}`;
		if (/configerror|unknown provider|invalid provider|agentfs binary not found/i.test(reportMsg))
			return reportMsg;
		return reportMsg;
	}

	const tail = stderrLines.slice(-50).join("\n");
	const L = tail.toLowerCase();

	if (/token has expired|sso session|sso.*expired|expired token/i.test(tail))
		return "AWS SSO session expired — run `aws sso login` and retry.";
	if (/unable to locate credentials|no credentials|credentialretrieval|expiredtoken/i.test(tail))
		return "AWS credentials missing or expired.";
	if (/401 unauthorized|invalid[_ -]?api[_ -]?key|authentication.*fail/i.test(tail))
		return "LLM provider rejected the API key (401).";
	if (/403 forbidden|accessdenied/i.test(tail)) return "LLM provider denied access (403).";
	if (/429 too many requests|rate limit|ratelimit/i.test(tail))
		return "Rate limited by the LLM provider (429). Retry after backoff.";
	if (/econnrefused|connection refused/i.test(tail))
		return "Connection refused — is the LLM proxy / MLX server running?";
	if (/enotfound|name or service not known|dns/i.test(L) && /proxy|api|model/.test(L))
		return "DNS lookup failed for the LLM endpoint.";
	if (/context window exceeded|contextoverflowerror/i.test(tail))
		return "Context window exceeded (swival could not recover after truncation retries).";
	if (/toolsnotsupportederror|does not support function calling|does not support chat completions with tools/i.test(tail))
		return "Model does not support function calling.";
	if (/lifecycleerror|lifecycle.*hook failed/i.test(tail))
		return "Lifecycle hook failed (fail-closed mode).";
	if (/configerror|unknown provider|invalid provider|agentfs binary not found/i.test(tail))
		return tail.split("\n").filter((l) => l.trim()).slice(-1)[0] ?? "swival config error.";
	if (/e2big|argument list too long|exec.*failed/i.test(tail))
		return "System prompt too large (ARG_MAX). Trim the agent body or move content into skills.";
	return undefined;
}

// ---------------------------------------------------- trace tailing --

/**
 * Tails a swival `--trace-dir` JSONL file, emitting TraceEvent updates to
 * the supplied callback whenever a new line lands. Swival writes one
 * `<sessionId>.jsonl` per session; since we use a private trace dir per
 * run, we can blindly watch the directory for the first `.jsonl` file to
 * appear and follow it.
 *
 * Returns an async cleanup that flushes any remaining content and stops
 * the watcher.
 */
export function startTraceTail(
	traceDir: string,
	onEvent: (event: TraceEvent) => void,
): () => Promise<void> {
	let watcher: fs.FSWatcher | null = null;
	let fileWatcher: fs.FSWatcher | null = null;
	let traceFile: string | null = null;
	let position = 0;
	let buffer = "";
	const toolUseNames = new Map<string, string>();

	let consuming = false;
	let shouldRerun = false;
	const consume = async () => {
		if (consuming) { shouldRerun = true; return; }
		consuming = true;
		try {
			do {
				shouldRerun = false;
				if (!traceFile) return;
				let stat: fs.Stats;
				try {
					stat = await fs.promises.stat(traceFile);
				} catch {
					return;
				}
				if (stat.size <= position) return;
				let handle: fs.promises.FileHandle | undefined;
				try {
					handle = await fs.promises.open(traceFile, "r");
					// Read in bounded chunks so a burst-appended trace doesn't spike
					// memory. 64 KiB is large enough to cover most single-turn deltas
					// in one pass and small enough that peak RSS stays predictable
					// even when `fs.watch` coalesces multiple append events.
					const CHUNK_BYTES = 64 * 1024;
					const chunk = Buffer.alloc(CHUNK_BYTES);
					const end = stat.size;
					while (position < end) {
						const want = Math.min(CHUNK_BYTES, end - position);
						const { bytesRead } = await handle.read(chunk, 0, want, position);
						if (bytesRead <= 0) break;
						position += bytesRead;
						buffer += chunk.toString("utf-8", 0, bytesRead);
					}
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (!line.trim()) continue;
						let obj: Record<string, unknown>;
						try {
							obj = JSON.parse(line) as Record<string, unknown>;
						} catch {
							continue;
						}
						const t = obj.type;
						if (t === "assistant" && obj.message) {
							const msg = obj.message as Record<string, unknown>;
							const content = msg.content;
							if (Array.isArray(content)) {
								for (const part of content) {
									if (!part || typeof part !== "object") continue;
									const p = part as Record<string, unknown>;
									if (p.type === "tool_use" && typeof p.name === "string") {
										if (typeof p.id === "string") toolUseNames.set(p.id, p.name);
										const args = (p.input as Record<string, unknown>) ?? {};
										onEvent({ type: "toolCall", name: p.name, args });
									} else if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
										onEvent({ type: "text", text: p.text });
									}
								}
							}
						}
						if (t === "user" && obj.message) {
							// tool_result arrives as user-role with content list.
							const msg = obj.message as Record<string, unknown>;
							const content = msg.content;
							if (Array.isArray(content)) {
								for (const part of content) {
									if (!part || typeof part !== "object") continue;
									const p = part as Record<string, unknown>;
									if (p.type === "tool_result" && typeof p.tool_use_id === "string") {
										const name = toolUseNames.get(p.tool_use_id) ?? "tool";
										const ok = p.is_error !== true;
										onEvent({ type: "toolCall", name, args: {}, ok });
									}
								}
							}
						}
					}
				} finally {
					if (handle) await handle.close().catch(() => undefined);
				}
			} while (shouldRerun);
		} finally {
			consuming = false;
		}
	};

	const attachFileWatcher = () => {
		if (!traceFile || fileWatcher) return;
		try {
			fileWatcher = fs.watch(traceFile, { persistent: false }, () => {
				void consume();
			});
		} catch {
			/* file may not exist yet */
		}
	};

	const pickTraceFile = async () => {
		try {
			const entries = await fs.promises.readdir(traceDir);
			const jsonl = entries.find((e) => e.endsWith(".jsonl"));
			if (jsonl) {
				traceFile = path.join(traceDir, jsonl);
				attachFileWatcher();
				await consume();
			}
		} catch {
			/* trace dir not created yet */
		}
	};

	try {
		watcher = fs.watch(traceDir, { persistent: false }, () => {
			void pickTraceFile();
		});
	} catch {
		/* ignore — trace tail is best-effort */
	}
	void pickTraceFile();

	return async () => {
		watcher?.close();
		fileWatcher?.close();
		await consume();
	};
}

// ---------------------------------------------------------- run single --

async function runSingleSwival(
	defaultCwd: string,
	agents: SwivalAgentConfig[],
	agentName: string,
	task: string,
	cwd: string | undefined,
	overrides: SwivalOverrides,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SwivalResult[]) => SwivalDetails,
): Promise<SwivalResult> {
	const agent = agents.find((a) => a.name === agentName);
	if (!agent) {
		const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			finalOutput: "",
			stderrTail: [`Unknown swival agent: "${agentName}". Available: ${available}`],
			durationMs: 0,
			errorMessage: `Unknown swival agent: "${agentName}"`,
		};
	}

	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-swival-"));
	const reportPath = path.join(tmpDir, "report.json");
	const traceDir = path.join(tmpDir, "trace");
	await fs.promises.mkdir(traceDir, { recursive: true });
	const runCwd = cwd ?? defaultCwd;

	const current: SwivalResult = {
		agent: agent.name,
		agentSource: agent.source,
		task,
		exitCode: -1,
		finalOutput: "",
		stderrTail: [],
		durationMs: 0,
		traceEvents: [],
	};

	const stderrLines: string[] = [];
	let stdoutBuf = "";
	let stderrBuf = "";

	const emit = () => {
		if (!onUpdate) return;
		const preview = current.finalOutput.trim() || stderrLines.slice(-3).join("\n") || "(running...)";
		onUpdate({
			content: [{ type: "text", text: preview }],
			details: makeDetails([current]),
		});
	};

	const stopTrace = startTraceTail(traceDir, (event) => {
		if (!current.traceEvents) current.traceEvents = [];
		// Merge tool_result results into the matching toolCall to avoid
		// doubling events; we only track the most recent pending call for a
		// name because the trace does not carry unique ids we can cheaply key
		// on from this side.
		if (event.type === "toolCall" && event.ok !== undefined) {
			for (let i = current.traceEvents.length - 1; i >= 0; i--) {
				const prev = current.traceEvents[i];
				if (prev.type === "toolCall" && prev.name === event.name && prev.ok === undefined) {
					prev.ok = event.ok;
					emit();
					return;
				}
			}
		}
		current.traceEvents.push(event);
		emit();
	});

	const started = Date.now();
	// Attach our internal trace-dir override only if the caller hasn't already
	// requested one (overrides.traceDir outranks us; mostly useful for tests).
	const effectiveOverrides: SwivalOverrides = { ...overrides, traceDir: overrides.traceDir ?? traceDir };
	const args = buildSwivalArgs(agent, reportPath, runCwd, effectiveOverrides);
	// `--` separates options from positional arguments. Without it, a task
	// starting with `-` or `--` would be consumed by swival's argparse as a
	// flag (argv injection). We always emit the separator; swival tolerates
	// an unused trailing `--`.
	args.push("--", task);

	try {
		const exitCode = await new Promise<number>((resolve) => {
			const proc = spawn("swival", args, {
				cwd: runCwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});

			proc.stdout.on("data", (buf: Buffer) => {
				stdoutBuf += buf.toString("utf-8");
				if (stdoutBuf.length > STDOUT_TAIL_CHARS * 4) {
					stdoutBuf = stdoutBuf.slice(-STDOUT_TAIL_CHARS * 4);
				}
				current.finalOutput = stdoutBuf;
				emit();
			});

			proc.stderr.on("data", (buf: Buffer) => {
				stderrBuf += stripAnsi(buf.toString("utf-8"));
				const lines = stderrBuf.split("\n");
				stderrBuf = lines.pop() ?? "";
				for (const line of lines) {
					const trimmed = line.replace(/\r$/, "");
					if (trimmed.trim().length === 0) continue;
					stderrLines.push(trimmed);
				}
				current.stderrTail = tail(stderrLines, STDERR_TAIL_LINES);
				emit();
			});

			proc.on("close", (code, signal) => {
				if (stderrBuf.trim()) stderrLines.push(stderrBuf);
				if (code === null) {
					// The process exited because of a signal (typically our
					// AbortSignal → SIGTERM/SIGKILL path). Record it so the
					// failure doesn't masquerade as success when the report is
					// missing. Use the POSIX 128 + signum convention for the
					// resolved exit code so downstream consumers see a non-zero
					// value.
					const sigLabel = signal ?? "signal";
					stderrLines.push(`swival process terminated by ${sigLabel}`);
					current.stderrTail = tail(stderrLines, STDERR_TAIL_LINES);
					const signalExit = signal === "SIGKILL" ? 137 : signal === "SIGTERM" ? 143 : 1;
					resolve(signalExit);
					return;
				}
				current.stderrTail = tail(stderrLines, STDERR_TAIL_LINES);
				resolve(code);
			});

			proc.on("error", (err) => {
				stderrLines.push(`spawn error: ${err.message}`);
				current.stderrTail = tail(stderrLines, STDERR_TAIL_LINES);
				resolve(1);
			});

			if (signal) {
				const kill = () => {
					proc.kill("SIGTERM");
					// proc.killed is set synchronously by kill(), so we track
					// escalation with our own flag + listen for process exit.
					let escalated = false;
					const escalation = setTimeout(() => {
						escalated = true;
						try { proc.kill("SIGKILL"); } catch { /* already dead */ }
					}, 5000);
					proc.on("close", () => {
						if (!escalated) clearTimeout(escalation);
					});
				};
				if (signal.aborted) kill();
				else signal.addEventListener("abort", kill, { once: true });
			}
		});

		current.exitCode = exitCode;
		current.durationMs = Date.now() - started;
		current.report = await readReport(reportPath);

		// Prefer result.answer from the report JSON as the authoritative final
		// output. Swival streams the answer to stdout too, but our 16KB stdout
		// ring-buffer (STDOUT_TAIL_CHARS*4) silently truncates long answers.
		// The report JSON carries the complete, un-truncated answer.
		if (current.report?.answer && current.report.answer.trim()) {
			current.finalOutput = current.report.answer.trim();
		} else {
			current.finalOutput = stdoutBuf.trim();
		}

		if (isRunFailure(current) && !current.errorMessage) {
			// Prefer the classified headline, fall back to stderr tail.
			current.errorMessage =
				classifyFailure(stderrLines, current.report) ??
				stderrLines.slice(-5).join("\n") ??
				(current.exitCode !== 0
					? `swival exited ${current.exitCode}`
					: `swival reported outcome=${current.report?.outcome ?? "unknown"}`);
		}
		return current;
	} finally {
		// Stop tailing and flush one more time before cleanup.
		try {
			await stopTrace();
		} catch {
			/* ignore */
		}
		// Best-effort cleanup.
		try {
			await fs.promises.rm(tmpDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
}

// ---------------------------------------------------------- concurrency --

async function mapWithConcurrency<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const i = nextIndex++;
			if (i >= items.length) return;
			results[i] = await fn(items[i], i);
		}
	});
	await Promise.all(workers);
	return results;
}

// ------------------------------------------------------- tool registry --

const TaskItem = Type.Object({
	agent: Type.String({ description: "Swival agent name" }),
	task: Type.String({ description: "Task to delegate" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the swival process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Swival agent name" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior step's output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the swival process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which swival-agents directories to use. Default: "user".',
	default: "user",
});

const SwivalParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Swival agent name (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(
		Type.Array(ChainItem, {
			description:
				"Array of {agent, task} run sequentially; each step's task may reference '{previous}' which is replaced with the prior step's final answer.",
		}),
	),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the swival process (single mode)" })),

	// Dispatch-time overrides (outrank agent frontmatter).
	modelOverride: Type.Optional(Type.String({ description: "Override the agent's model for this call." })),
	profileOverride: Type.Optional(Type.String({ description: "Override the agent's profile for this call." })),
	providerOverride: Type.Optional(Type.String({ description: "Override the agent's provider for this call." })),
	baseUrlOverride: Type.Optional(
		Type.String({ description: "Override the agent's base URL for this call." }),
	),
	selfReviewOverride: Type.Optional(
		Type.Boolean({
			description:
				"Force-enable (true) or suppress (false) --self-review; cannot disable an active --reviewer script set by the agent.",
		}),
	),
	reviewerOverride: Type.Optional(
		Type.String({
			description:
				"Override --reviewer script path for this call. Mutually exclusive with selfReviewOverride=true.",
		}),
	),
	reviewPromptOverride: Type.Optional(
		Type.String({ description: "Override --review-prompt for this call." }),
	),
	maxReviewRoundsOverride: Type.Optional(
		Type.Number({ description: "Override --max-review-rounds for this call." }),
	),
	maxTurnsOverride: Type.Optional(Type.Number({ description: "Override --max-turns for this call." })),
	maxOutputTokensOverride: Type.Optional(
		Type.Number({ description: "Override --max-output-tokens for this call." }),
	),
	temperatureOverride: Type.Optional(Type.Number({ description: "Override --temperature for this call." })),
	topPOverride: Type.Optional(Type.Number({ description: "Override --top-p for this call." })),
	seedOverride: Type.Optional(Type.Number({ description: "Override --seed for this call." })),
	reasoningEffortOverride: Type.Optional(
		Type.String({ description: "Override --reasoning-effort for this call." }),
	),
	cacheOverride: Type.Optional(Type.Boolean({ description: "Override --cache for this call." })),
	cacheDirOverride: Type.Optional(Type.String({ description: "Override --cache-dir for this call." })),
	verifyOverride: Type.Optional(
		Type.String({ description: "Override --verify acceptance criteria file for this call." }),
	),
	encryptSecretsOverride: Type.Optional(
		Type.Boolean({ description: "Override --encrypt-secrets for this call." }),
	),
});

function buildOverridesFromParams(params: Record<string, unknown>): SwivalOverrides {
	const g = <T>(k: string): T | undefined => params[k] as T | undefined;
	return {
		model: g<string>("modelOverride"),
		profile: g<string>("profileOverride"),
		provider: g<string>("providerOverride"),
		baseUrl: g<string>("baseUrlOverride"),
		selfReview: g<boolean>("selfReviewOverride"),
		reviewer: g<string>("reviewerOverride"),
		reviewPrompt: g<string>("reviewPromptOverride"),
		maxReviewRounds: g<number>("maxReviewRoundsOverride"),
		maxTurns: g<number>("maxTurnsOverride"),
		maxOutputTokens: g<number>("maxOutputTokensOverride"),
		temperature: g<number>("temperatureOverride"),
		topP: g<number>("topPOverride"),
		seed: g<number>("seedOverride"),
		reasoningEffort: g<string>("reasoningEffortOverride"),
		cache: g<boolean>("cacheOverride"),
		cacheDir: g<string>("cacheDirOverride"),
		verify: g<string>("verifyOverride"),
		encryptSecrets: g<boolean>("encryptSecretsOverride"),
	};
}

function renderOutcome(r: SwivalResult): string {
	if (r.exitCode === -1) return "running";
	if (r.exitCode !== 0) return "failed";
	if (r.report?.outcome === "success") return "accepted";
	if (r.report?.outcome === "failed") return "rejected";
	if (r.report?.outcome === "error") return "error";
	return "completed";
}

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Header meta string for a single swival result. Shape:
 *   "opus-reviewed · 3 rounds · 8 tool calls · 12.4s · accepted"
 * Pieces are omitted when the underlying stat is missing or zero.
 */
function buildHeaderMeta(r: SwivalResult): string {
	const parts: string[] = [];
	const model = r.report?.model;
	if (model) parts.push(model);
	const rounds = r.report?.reviewRounds;
	if (typeof rounds === "number" && rounds > 0) {
		parts.push(`${rounds} round${rounds === 1 ? "" : "s"}`);
	}
	const turns = r.report?.turns;
	if (typeof turns === "number" && turns > 0) {
		parts.push(`${turns} turn${turns === 1 ? "" : "s"}`);
	}
	const toolCalls = r.report?.toolCallsTotal;
	if (typeof toolCalls === "number" && toolCalls > 0) {
		parts.push(`${toolCalls} tool call${toolCalls === 1 ? "" : "s"}`);
	}
	if (r.durationMs) parts.push(formatDuration(r.durationMs));
	parts.push(renderOutcome(r));
	return parts.join(" · ");
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "swival-subagent",
		label: "Swival subagent",
		description: [
			"Delegate a task to a swival subprocess with its built-in reviewer loop.",
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with '{previous}' substitution).",
			"Agents live in ~/.pi/agent/swival-agents/ (user) or .pi/swival-agents/ (project).",
			"Use this when you want the reviewer loop, test-as-contract, sandbox overlay, or secret encryption to wrap the subagent's work.",
		].join(" "),
		// Surface this tool in the default system prompt's "Available tools"
		// section and contribute a bullet to "Guidelines". Without
		// `promptSnippet`, Pi leaves custom tools out of the "Available tools"
		// list entirely (see pi docs/extensions.md), so the model only sees the
		// tool via its schema at invocation time.
		promptSnippet:
			"Delegate to swival with reviewer loop, AgentFS sandbox, test-as-contract, or secret encryption",
		promptGuidelines: [
			"Use swival-subagent when a task benefits from swival's reviewer loop (retry until acceptance passes), a test-as-contract script, OS-enforced filesystem isolation via AgentFS, or format-preserving secret encryption — otherwise prefer simpler tools.",
		],
		parameters: SwivalParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			// Project-agent discovery must walk up from the effective working
			// directory the swival process will run in, not Pi's own cwd. In
			// single mode that is params.cwd if provided; in parallel/chain modes
			// individual steps may override per-task, but we still anchor the
			// initial discovery to the top-level params.cwd so e.g. dispatching
			// from a repo root finds agents in .pi/swival-agents/.
			const discoveryCwd = params.cwd ?? ctx.cwd;
			const discovery = discoverSwivalAgents(discoveryCwd, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;
			const overrides = buildOverridesFromParams(params as unknown as Record<string, unknown>);

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			// Default to the generic "swival" agent when task is provided without an explicit agent.
			if (!params.agent && params.task && !hasChain && !hasTasks) {
				params.agent = "swival";
			}
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: SwivalResult[]): SwivalDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode (agent+task OR tasks[] OR chain[]).\nAvailable swival agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
				};
			}

			// Project-local agent approval, mirroring pi's subagent extension.
			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI) {
				const requested = new Set<string>();
				if (params.chain) for (const s of params.chain) requested.add(s.agent);
				if (params.tasks) for (const t of params.tasks) requested.add(t.agent);
				if (params.agent) requested.add(params.agent);
				const projectRequested = Array.from(requested)
					.map((n) => agents.find((a) => a.name === n))
					.filter((a): a is SwivalAgentConfig => a?.source === "project");
				if (projectRequested.length > 0) {
					const names = projectRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local swival agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject swival agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok) {
						return {
							content: [{ type: "text", text: "Canceled: project-local swival agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
					}
				}
			}

			if (params.chain && params.chain.length > 0) {
				if (params.chain.length > MAX_PARALLEL_TASKS) {
					return {
						content: [
							{
								type: "text",
								text: `Too many chain steps (${params.chain.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("chain")([]),
					};
				}
				const results: SwivalResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								const current = partial.details?.results[0];
								if (current) {
									const all = [...results, current];
									onUpdate({ content: partial.content, details: makeDetails("chain")(all) });
								}
							}
						: undefined;

					const r = await runSingleSwival(
						ctx.cwd,
						agents,
						step.agent,
						taskWithContext,
						step.cwd,
						overrides,
						signal,
						chainUpdate,
						makeDetails("chain"),
					);
					results.push(r);

					if (isRunFailure(r)) {
						return {
							content: [
								{
									type: "text",
									text: `swival chain stopped at step ${i + 1} (${step.agent}): ${r.errorMessage ?? "(no message)"}`,
								},
							],
							details: makeDetails("chain")(results),
							isError: true,
						};
					}
					previousOutput = r.finalOutput;
				}
				const last = results[results.length - 1];
				return {
					content: [{ type: "text", text: last.finalOutput || "(no output)" }],
					details: makeDetails("chain")(results),
				};
			}

			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS) {
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};
				}

				const placeholders: SwivalResult[] = params.tasks.map((t) => ({
					agent: t.agent,
					agentSource: "unknown",
					task: t.task,
					exitCode: -1,
					finalOutput: "",
					stderrTail: [],
					durationMs: 0,
				}));

				const emitParallel = () => {
					if (!onUpdate) return;
					const running = placeholders.filter((r) => r.exitCode === -1).length;
					const done = placeholders.length - running;
					onUpdate({
						content: [
							{
								type: "text",
								text: `swival parallel: ${done}/${placeholders.length} done, ${running} running`,
							},
						],
						details: makeDetails("parallel")([...placeholders]),
					});
				};

				const results = await mapWithConcurrency(params.tasks, MAX_CONCURRENCY, async (t, idx) => {
					const r = await runSingleSwival(
						ctx.cwd,
						agents,
						t.agent,
						t.task,
						t.cwd,
						overrides,
						signal,
						(partial) => {
							if (partial.details?.results[0]) {
								placeholders[idx] = partial.details.results[0];
								emitParallel();
							}
						},
						makeDetails("parallel"),
					);
					placeholders[idx] = r;
					emitParallel();
					return r;
				});

				const ok = results.filter((r) => !isRunFailure(r)).length;
				const summary = results
					.map((r) => `[${r.agent}] ${renderOutcome(r)}: ${r.finalOutput.split("\n")[0].slice(0, 100)}`)
					.join("\n");
				return {
					content: [{ type: "text", text: `swival parallel: ${ok}/${results.length} succeeded\n\n${summary}` }],
					details: makeDetails("parallel")(results),
				};
			}

			// Single mode
			const result = await runSingleSwival(
				ctx.cwd,
				agents,
				params.agent as string,
				params.task as string,
				params.cwd,
				overrides,
				signal,
				onUpdate,
				makeDetails("single"),
			);
			const isError = isRunFailure(result);
			if (isError) {
				return {
					content: [
						{
							type: "text",
							text: `swival agent failed (exit ${result.exitCode}): ${result.errorMessage ?? "(no message)"}`,
						},
					],
					details: makeDetails("single")([result]),
					isError: true,
				};
			}
			return {
				content: [{ type: "text", text: result.finalOutput || "(no output)" }],
				details: makeDetails("single")([result]),
			};
		},

		// ---------------------------------------------------- render call --

		renderCall(args, theme, _context) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.chain && args.chain.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("swival ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					const clean = step.task.replace(/\{previous\}/g, "").trim();
					const preview = clean.length > 40 ? `${clean.slice(0, 40)}...` : clean;
					text +=
						`\n  ${theme.fg("muted", `${i + 1}.`)} ${theme.fg("accent", step.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			if (args.tasks && args.tasks.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("swival ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 50 ? `${t.task.slice(0, 50)}...` : t.task;
					text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agentName = args.agent || "...";
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			const text =
				theme.fg("toolTitle", theme.bold("swival ")) +
				theme.fg("accent", agentName) +
				theme.fg("muted", ` [${scope}]`) +
				`\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		// -------------------------------------------------- render result --

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as SwivalDetails | undefined;
			if (!details || details.results.length === 0) {
				const t = result.content[0];
				return new Text(t?.type === "text" ? t.text : "(no output)", 0, 0);
			}
			const mdTheme = getMarkdownTheme();

			const renderOne = (r: SwivalResult, container: Container) => {
				const rIcon =
					r.exitCode === -1
						? theme.fg("warning", "⏳")
						: isRunFailure(r)
							? theme.fg("error", "✗")
							: theme.fg("success", "✓");
				const meta = buildHeaderMeta(r);
				container.addChild(
					new Text(`${rIcon} ${theme.fg("accent", r.agent)} ${theme.fg("muted", meta)}`, 0, 0),
				);
				container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));
				if (r.errorMessage) {
					container.addChild(new Text(theme.fg("error", r.errorMessage), 0, 0));
				}
				// Per-tool-call progress from trace tailing. Always show a recent
				// slice while the run is in flight so Pi's UI has something live.
				const trace = r.traceEvents ?? [];
				const toolCallEvents = trace.filter((e): e is TraceToolCall => e.type === "toolCall");
				const TRACE_PREVIEW_LIMIT = expanded ? toolCallEvents.length : 6;
				if (toolCallEvents.length > 0 && (expanded || r.exitCode === -1)) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── tool calls ───"), 0, 0));
					const shown = toolCallEvents.slice(-TRACE_PREVIEW_LIMIT);
					if (toolCallEvents.length > TRACE_PREVIEW_LIMIT) {
						container.addChild(
							new Text(theme.fg("dim", `… ${toolCallEvents.length - TRACE_PREVIEW_LIMIT} earlier calls omitted`), 0, 0),
						);
					}
					for (const ev of shown) {
						const marker =
							ev.ok === true
								? theme.fg("success", "✓ ")
								: ev.ok === false
									? theme.fg("error", "✗ ")
									: theme.fg("muted", "→ ");
						const argsStr = Object.keys(ev.args).length > 0 ? JSON.stringify(ev.args) : "";
						const preview = argsStr.length > 60 ? `${argsStr.slice(0, 60)}…` : argsStr;
						container.addChild(
							new Text(
								marker + theme.fg("accent", ev.name) + (preview ? " " + theme.fg("dim", preview) : ""),
								0,
								0,
							),
						);
					}
				}
				// On rejection, surface the last reviewer feedback so Pi's UI shows
				// why the reviewer bounced the attempt. Expanded view always shows it.
				const fb = r.report?.lastReviewFeedback;
				const showFeedback = !!fb && (expanded || r.report?.accepted === false);
				if (showFeedback && fb) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── reviewer feedback ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", fb), 0, 0));
				}
				if (expanded && r.stderrTail.length > 0) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── stderr tail ───"), 0, 0));
					for (const line of r.stderrTail) {
						container.addChild(new Text(theme.fg("dim", line), 0, 0));
					}
				}
				if (r.finalOutput) {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(r.finalOutput.trim(), 0, 0, mdTheme));
				}
				if (expanded) {
					const statParts: string[] = [];
					if (typeof r.report?.llmCalls === "number") statParts.push(`${r.report.llmCalls} llm calls`);
					if (typeof r.report?.totalLlmTimeS === "number")
						statParts.push(`llm ${r.report.totalLlmTimeS.toFixed(1)}s`);
					if (typeof r.report?.totalToolTimeS === "number" && r.report.totalToolTimeS > 0)
						statParts.push(`tools ${r.report.totalToolTimeS.toFixed(1)}s`);
					if (typeof r.report?.compactions === "number" && r.report.compactions > 0)
						statParts.push(`${r.report.compactions} compaction${r.report.compactions === 1 ? "" : "s"}`);
					const by = r.report?.toolCallsByName;
					if (by && Object.keys(by).length > 0) {
						const entries = Object.entries(by)
							.map(([name, v]) => {
								const ok = v.succeeded ?? 0;
								const fail = v.failed ?? 0;
								return fail > 0 ? `${name}:${ok}/${ok + fail}` : `${name}:${ok}`;
							})
							.sort();
						statParts.push(entries.join(" "));
					}
					if (statParts.length > 0) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", statParts.join(" · ")), 0, 0));
					}
				}
			};

			if (details.mode === "single") {
				const container = new Container();
				renderOne(details.results[0], container);
				return container;
			}

			if (details.mode === "chain") {
				const container = new Container();
				const ok = details.results.filter((r) => !isRunFailure(r)).length;
				const running = details.results.filter((r) => r.exitCode === -1).length;
				const icon = running > 0 ? theme.fg("warning", "⏳") : ok === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");
				container.addChild(
					new Text(
						`${icon} ${theme.fg("toolTitle", theme.bold("swival chain "))}${theme.fg("accent", `${ok}/${details.results.length} steps`)}`,
						0,
						0,
					),
				);
				for (let i = 0; i < details.results.length; i++) {
					const r = details.results[i];
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", `─── step ${i + 1} ───`), 0, 0));
					renderOne(r, container);
				}
				return container;
			}

			// parallel
			const container = new Container();
			const running = details.results.filter((r) => r.exitCode === -1).length;
			const ok = details.results.filter((r) => !isRunFailure(r)).length;
			const isRunning = running > 0;
			const icon = isRunning
				? theme.fg("warning", "⏳")
				: ok === details.results.length
					? theme.fg("success", "✓")
					: theme.fg("warning", "◐");
			container.addChild(
				new Text(
					`${icon} ${theme.fg("toolTitle", theme.bold("swival parallel "))}${theme.fg("accent", `${ok}/${details.results.length}`)}`,
					0,
					0,
				),
			);
			for (const r of details.results) {
				container.addChild(new Spacer(1));
				renderOne(r, container);
			}
			return container;
		},
	});
}
