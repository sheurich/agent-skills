/**
 * MCP-Aware Compaction Extension
 *
 * Two mechanisms:
 *
 * 1. **Real-time compression** (tool_result): Intercepts large MCP tool
 *    results and replaces them with compact structured summaries before
 *    they enter the context window. A 260KB PagerDuty response becomes
 *    ~200 chars. The agent never sees the raw blob.
 *
 * 2. **Compaction handler** (session_before_compact): When Pi's auto-
 *    compaction fires, produces an MCP-aware summary that preserves
 *    service identifiers and query results instead of generic summaries.
 *
 * Placement: ~/.pi/agent/extensions/mcp-compaction/
 */

import { complete } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import {
	type AgentMessage,
	type ToolServerMap,
	buildToolServerMapFromCache,
	compressMcpResult,
	gatherMcpStats,
	resolveMcpIdentity,
} from "./compress.js";

// ── Configuration ───────────────────────────────────────────────────

/** Compress MCP results larger than this (bytes). */
const COMPRESS_THRESHOLD = 2_000;

// ── I/O: load MCP cache from disk ──────────────────────────────────

async function buildToolServerMap(): Promise<ToolServerMap> {
	try {
		const raw = await readFile(join(homedir(), ".pi/agent/mcp-cache.json"), "utf8");
		return buildToolServerMapFromCache(JSON.parse(raw));
	} catch {
		return new Map();
	}
}

// ── Serialization with MCP-aware compression (for compaction) ───────

function serializeWithMcpCompression(
	messages: AgentMessage[],
	toolServerMap: ToolServerMap,
): string {
	const sections: string[] = [];
	const nonMcpBatch: AgentMessage[] = [];

	const flushNonMcp = () => {
		if (nonMcpBatch.length === 0) return;
		const text = serializeConversation(convertToLlm(nonMcpBatch as any));
		if (text.trim()) sections.push(text);
		nonMcpBatch.length = 0;
	};

	for (const msg of messages) {
		const compressed = compressMcpResult(msg, toolServerMap);
		if (compressed) {
			flushNonMcp();
			sections.push(compressed);
		} else {
			nonMcpBatch.push(msg);
		}
	}
	flushNonMcp();

	return sections.join("\n\n");
}

// ── Extension entry point ───────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let toolServerMapCached: ToolServerMap | null = null;

	async function getToolServerMap(): Promise<ToolServerMap> {
		if (!toolServerMapCached) {
			toolServerMapCached = await buildToolServerMap();
		}
		return toolServerMapCached;
	}

	pi.on("session_start", async () => {
		toolServerMapCached = null;
	});

	// ── Real-time MCP result compression ────────────────────────────
	// Intercepts tool_result events for MCP call results. If the result
	// exceeds COMPRESS_THRESHOLD, replaces it with a compressed version
	// before it enters the context window.

	pi.on("tool_result", async (event, _ctx) => {
		// Only process MCP gateway results
		if (event.toolName !== "mcp") return;

		// Only compress mode=call results (not search/describe/list metadata)
		const details = event.details as Record<string, unknown> | undefined;
		if (!details || details.mode !== "call") return;

		// Check total text size
		const textBlocks = (event.content ?? []).filter(
			(c: any) => c.type === "text" && typeof c.text === "string",
		);
		const totalBytes = textBlocks.reduce(
			(sum: number, c: any) => sum + c.text.length,
			0,
		);
		if (totalBytes <= COMPRESS_THRESHOLD) return;

		// Build a minimal AgentMessage for compressMcpResult
		const tsm = await getToolServerMap();
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: event.toolName,
			content: event.content,
			details: event.details,
		};

		const compressed = compressMcpResult(msg, tsm);
		if (!compressed) return;

		// Replace the tool result content with the compressed version
		return {
			content: [{ type: "text" as const, text: compressed }],
		};
	});

	// ── Compaction handler: MCP-aware summarization ─────────────────
	// Runs when Pi's auto-compaction triggers (context approaching limit).
	// Produces structured summaries preserving service identifiers.

	pi.on("session_before_compact", async (event, ctx) => {
		const { preparation, branchEntries, signal } = event;
		const {
			messagesToSummarize,
			turnPrefixMessages,
			tokensBefore,
			firstKeptEntryId,
			previousSummary,
		} = preparation;

		const toolServerMap = await getToolServerMap();

		let allMessages = [...messagesToSummarize, ...turnPrefixMessages];

		// Degenerate case: both arrays empty (single massive turn).
		// Fall back to extracting messages from branchEntries.
		if (allMessages.length === 0 && branchEntries && branchEntries.length > 0) {
			allMessages = branchEntries
				.filter((e: any) => e.type === "message" && e.message)
				.map((e: any) => e.message);
		}

		const hasMcpResults = allMessages.some(
			(m: any) => resolveMcpIdentity(m, toolServerMap) !== null,
		);
		if (!hasMcpResults) return;

		// Find a model with working auth
		const candidates = [
			ctx.modelRegistry.find("google-vertex", "gemini-2.5-flash-lite"),
			ctx.modelRegistry.find("google-vertex", "gemini-2.5-flash"),
			ctx.modelRegistry.find("google", "gemini-2.5-flash-lite"),
			ctx.modelRegistry.find("google", "gemini-2.5-flash"),
			ctx.modelRegistry.find("amazon-bedrock", "global.anthropic.claude-haiku-4-5-20251001-v1:0"),
			ctx.modelRegistry.find("anthropic", "claude-haiku-4-5"),
			ctx.modelRegistry.find("openai", "gpt-5-nano"),
			ctx.modelRegistry.find("openai", "gpt-4.1-nano"),
			ctx.model,
		].filter(Boolean);

		let model = null;
		let apiKey = "";
		let headers: Record<string, string> | undefined;

		for (const candidate of candidates) {
			if (!candidate) continue;
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(candidate);
			if (auth.ok && (auth.apiKey || auth.headers)) {
				model = candidate;
				apiKey = auth.apiKey ?? "";
				headers = auth.headers;
				break;
			}
		}

		if (!model) {
			ctx.ui.notify("MCP compaction: no model with working auth, using default", "warning");
			return;
		}

		const conversationText = serializeWithMcpCompression(allMessages as any, toolServerMap);
		const mcpStats = gatherMcpStats(allMessages as any, toolServerMap);

		const previousContext = previousSummary
			? `\n\nPrevious session summary (incorporate and extend, do not lose information):\n${previousSummary}`
			: "";

		ctx.ui.notify(
			`MCP compaction: processing ${allMessages.length} messages (${tokensBefore.toLocaleString()} tokens) with ${model.id}`,
			"info",
		);

		const summaryMessages = [
			{
				role: "user" as const,
				content: [
					{
						type: "text" as const,
						text: `You are a session summarizer for an AI coding assistant. This conversation includes heavy use of external service APIs (MCP tools). Produce a structured summary that captures all information needed to continue the work.

MCP tool usage in this segment:
${mcpStats || "None detected"}

Requirements:
1. **Goal & Context**: What the user is trying to accomplish
2. **External Service Interactions**: For each MCP server used, summarize:
   - What was queried or modified
   - Key results and data points discovered
   - IDs, keys, and references that may be needed later (Jira keys, incident IDs, dashboard UIDs, email thread IDs, etc.)
3. **Key Decisions**: Decisions made based on service data
4. **Code & File Changes**: Technical modifications, if any
5. **Current State**: Where things stand — what's resolved, what's pending
6. **Open Questions & Blockers**
7. **Next Steps**

Preserve all identifiers (issue keys, incident numbers, UIDs, URLs) verbatim — these cannot be reconstructed.
Be thorough but eliminate redundancy. Use structured markdown.
${previousContext}

<conversation>
${conversationText}
</conversation>`,
					},
				],
				timestamp: Date.now(),
			},
		];

		try {
			const response = await complete(
				model,
				{ messages: summaryMessages },
				{ apiKey, headers, maxTokens: 8192, signal },
			);

			const summary = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			if (!summary.trim()) {
				if (!signal.aborted) {
					ctx.ui.notify("MCP compaction: empty summary, falling back to default", "warning");
				}
				return;
			}

			ctx.ui.notify("MCP compaction: done", "info");

			return {
				compaction: {
					summary,
					firstKeptEntryId,
					tokensBefore,
					details: { strategy: "mcp-aware", mcpStats, model: `${model.provider}/${model.id}` },
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!signal.aborted) {
				ctx.ui.notify(`MCP compaction failed: ${message}`, "error");
			}
			return;
		}
	});
}
