/**
 * Auto-Summarize Extension
 *
 * Maintains a rolling session summary and title in the background.
 * After each agent turn, sends the conversation delta to a budget model
 * and persists the result as a custom session entry.
 *
 * Commands:
 *   /summary   - show the current summary
 *   /autoname  - force a full re-summarize from the entire branch
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { complete, type Api, type Model } from "@mariozechner/pi-ai";
import type { CustomEntry, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { selectBudgetModel } from "./model-selection.ts";
import { createSummaryContext } from "./summary-request.ts";

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
};

type SummaryData = { title: string; summary: string };
type SummaryEntry = CustomEntry<SummaryData>;

const MAX_MESSAGE_CHARS = 4000;
const MAX_DELTA_CHARS = 16000;
const MAX_CONTEXT_CHARS = 8000;
const MAX_QUEUE_SIZE = 50;
const MIN_DELTA_CHARS = 100;
const DEBOUNCE_MS = 3_000;
const MIN_DRAIN_INTERVAL_MS = 10_000;

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : s.slice(0, max - 12) + "\n[truncated]";

const truncateTail = (s: string, max: number): string =>
  s.length <= max ? s : "[truncated]\n" + s.slice(s.length - max + 12);

const SUMMARIZE_PROMPT = `\
You maintain a rolling summary of a coding agent session.
Given the current state and the latest turn, produce an updated summary and a short title.

Rules:
- The summary captures goals, key decisions, progress, and next steps.
- The summary is concise: 3-8 bullet points, not prose paragraphs.
- The title is ≤72 characters, lowercase, format: \`topic: what happened\`.
- If the session just started, derive both from the turn alone.
- Drop stale information that has been superseded.
- The title captures the session's cumulative scope — what it is about overall, not just the most recent change or activity. Cover the full breadth of what the session addressed.
- When a current title is provided, prefer keeping or expanding it. Only rewrite it when the session's overall topic has changed.
- Use recent conversation context (when provided) to understand the session's trajectory beyond the compressed summary.

Respond with ONLY a JSON object (no markdown fences):
{"title": "...", "summary": "..."}`;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content as ContentBlock[]) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

function extractToolCalls(content: unknown): string[] {
  if (!Array.isArray(content)) return [];

  const calls: string[] = [];
  for (const block of content as ContentBlock[]) {
    if (block.type !== "toolCall" || typeof block.name !== "string") continue;
    const keys = Object.keys(block.arguments ?? {}).slice(0, 3);
    calls.push(keys.length > 0 ? `[tool: ${block.name}(${keys.join(", ")})]` : `[tool: ${block.name}]`);
  }
  return calls;
}

function buildDelta(messages: Array<{ role?: string; content?: unknown }>, maxChars = MAX_DELTA_CHARS): string {
  const parts: string[] = [];
  for (const msg of messages) {
    if (!msg.role) continue;
    if (msg.role === "user") {
      const text = extractText(msg.content).trim();
      if (text) parts.push(`User: ${truncate(text, MAX_MESSAGE_CHARS)}`);
    } else if (msg.role === "assistant") {
      const text = extractText(msg.content).trim();
      if (text) parts.push(`Assistant: ${truncate(text, MAX_MESSAGE_CHARS)}`);
      const tools = extractToolCalls(msg.content);
      if (tools.length > 0) parts.push(tools.join("\n"));
    }
  }
  return truncateTail(parts.join("\n\n"), maxChars);
}

/**
 * Extract recent messages from the session branch, walking backward
 * until a character budget is exhausted. Returns messages in
 * chronological order.
 */
function getRecentMessages(
  sessionCtx: ExtensionContext,
  budget: number,
): Array<{ role?: string; content?: unknown }> {
  const entries = sessionCtx.sessionManager.getBranch();
  const messages: Array<{ role?: string; content?: unknown }> = [];
  let chars = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "message" || !("message" in entry)) continue;
    const msg = (entry as { message: { role?: string; content?: unknown } }).message;
    if (!msg.role) continue;

    const textLen = extractText(msg.content).length;
    // +20 accounts for the "User: "/"Assistant: " prefix and separators that buildDelta adds
    const msgChars = Math.min(textLen, MAX_MESSAGE_CHARS) + 20;
    if (chars + msgChars > budget && messages.length > 0) break;

    messages.unshift(msg);
    chars += msgChars;
  }

  return messages;
}

function parseJson(text: string): SummaryData | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "");
    const obj = JSON.parse(cleaned);
    if (!obj || typeof obj !== "object") return null;

    let { title, summary } = obj as { title?: unknown; summary?: unknown };

    if (Array.isArray(summary)) {
      summary = summary.map((s) => `- ${String(s).trim()}`).join("\n");
    }

    if (typeof title !== "string" || typeof summary !== "string") return null;
    return { title, summary };
  } catch {
    return null;
  }
}

function loadPiSettings(): Record<string, unknown> {
  const configDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  try {
    return JSON.parse(readFileSync(join(configDir, "settings.json"), "utf8"));
  } catch {
    return {};
  }
}

/** Try the configured budget model first, then known budget fallbacks. */
function findModel(ctx: ExtensionContext): Model<Api> | undefined {
  return selectBudgetModel(
    ctx.modelRegistry.getAll(),
    (m) => ctx.modelRegistry.hasConfiguredAuth(m),
    loadPiSettings(),
  ) as Model<Api> | undefined;
}

export default function (pi: ExtensionAPI) {
  let summary = "";
  let title = "";
  let ctx: ExtensionContext | null = null; // cached for background drains
  let model: Model<Api> | undefined;
  const queue: string[] = [];
  let drainPromise = Promise.resolve();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;
  let lastDrainTimestamp = 0;
  const MAX_RETRIES = 2;

  /** Reset all mutable state and restore summary from the new session's branch. */
  function resetForSession(newCtx: ExtensionContext) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    queue.length = 0;
    drainPromise = Promise.resolve();
    consecutiveFailures = 0;
    lastDrainTimestamp = 0;

    ctx = newCtx;
    model = undefined;
    summary = "";
    title = "";

    for (const entry of newCtx.sessionManager.getBranch()) {
      if (entry.type === "custom" && (entry as SummaryEntry).customType === "auto-summary") {
        const data = (entry as SummaryEntry).data;
        summary = data?.summary ?? "";
        title = data?.title ?? "";
      }
    }
  }

  // session_start fires for all lifecycle transitions including switches
  // (reason: "resume") and forks (reason: "fork"), so one handler suffices.
  pi.on("session_start", async (_event, newCtx) => resetForSession(newCtx));

  pi.on("session_shutdown", async (_event, shutdownCtx) => {
    ctx = shutdownCtx;
    if (queue.length > 0) {
      drainNow();
      await drainPromise;
    }
  });

  pi.on("session_compact", async (event, compactCtx) => {
    ctx = compactCtx;
    const compaction = (event as { compactionEntry?: { summary?: string } }).compactionEntry;
    const note = compaction?.summary
      ? `[system: conversation compacted. Compaction summary: ${truncate(compaction.summary, 2000)}. Update your rolling summary — earlier turns are no longer in context.]`
      : "[system: conversation compacted — earlier turns removed from context. Update summary to reflect only what remains relevant.]";
    queue.push(note);
    scheduleDrain();
  });

  pi.on("agent_end", async (event) => {
    const delta = buildDelta(event.messages as Array<{ role?: string; content?: unknown }>);
    if (!delta.trim()) return;
    queue.push(delta);
    if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    scheduleDrain();
  });

  function scheduleDrain() {
    if (debounceTimer) clearTimeout(debounceTimer);
    // First turn (no summary yet): drain immediately after debounce.
    // Subsequent turns: enforce cooldown between drains.
    const isFirstDrain = !summary;
    const cooldown = isFirstDrain ? 0 : Math.max(0, MIN_DRAIN_INTERVAL_MS - (Date.now() - lastDrainTimestamp));
    const delay = Math.max(DEBOUNCE_MS, cooldown);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      drainPromise = drainPromise
        .then(() => (queue.length > 0 ? drain() : undefined))
        .catch(() => {});
    }, delay);
  }

  function drainNow() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    drainPromise = drainPromise
      .then(() => (queue.length > 0 ? drain() : undefined))
      .catch(() => {});
  }

  async function drain(): Promise<string | undefined> {
    if (!ctx || queue.length === 0) return;

    const m = model ?? (model = findModel(ctx));
    if (!m) {
      return "no budget model found in registry";
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(m);
    if (!auth.ok) {
      model = undefined;
      return `auth failed for ${m.provider}/${m.id}: ${(auth as { error?: string }).error ?? "unknown"}`;
    }
    // Do not require auth.apiKey: SigV4 providers (e.g. amazon-bedrock)
    // authenticate via the credential chain / env, not a bearer key, so
    // apiKey is legitimately undefined there. auth.ok is the real signal.

    // Consume queue only after confirming model + auth are available.
    const deltas = queue.splice(0);
    const combined = truncateTail(deltas.join("\n---\n"), MAX_DELTA_CHARS);

    // Skip trivial turns that won't meaningfully change the summary.
    // Always process the first turn — even short prompts need a title.
    if (summary && combined.length < MIN_DELTA_CHARS) return;

    // Build prompt sections. Incremental updates include recent branch
    // context so the model sees raw conversation beyond the compressed
    // summary, closing the quality gap with /autoname.
    const sections: string[] = [SUMMARIZE_PROMPT];

    if (title) {
      sections.push(`## Current title\n${title}`);
    }

    sections.push(`## Current summary\n${summary || "(new session — no summary yet)"}`);

    if (summary && ctx) {
      // Recent context may partially overlap with the latest-turn delta
      // (the branch already contains persisted messages by the time drain
      // runs). The redundancy is acceptable — budget headroom is ample and
      // the model handles duplicate content gracefully.
      const recentMsgs = getRecentMessages(ctx, MAX_CONTEXT_CHARS);
      if (recentMsgs.length > 0) {
        const recentContext = buildDelta(recentMsgs, MAX_CONTEXT_CHARS);
        if (recentContext.trim()) {
          sections.push(`## Recent conversation context\n${recentContext}`);
        }
      }
    }

    sections.push(`## ${deltas.length > 1 ? `Latest turns (${deltas.length} combined)` : "Latest turn"}\n${combined}`);

    const prompt = sections.join("\n\n");

    try {
      const response = await complete(
        m,
        createSummaryContext(prompt),
        { apiKey: auth.apiKey, headers: auth.headers, env: auth.env, maxTokens: 1024 },
      );

      const text = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");

      if (!text) {
        const types = response.content.map((c: { type: string }) => c.type).join(", ") || "empty";
        model = undefined;
        return `model returned no text (content types: ${types}; model: ${m.provider}/${m.id})`;
      }

      const parsed = parseJson(text);
      if (!parsed) {
        model = undefined;
        return `JSON parse failed: ${truncate(text, 200)}`;
      }

      consecutiveFailures = 0;
      lastDrainTimestamp = Date.now();
      if (parsed.title && parsed.title !== title) {
        title = parsed.title;
        pi.setSessionName(title);
      }
      if (parsed.summary) {
        summary = parsed.summary;
      }
      pi.appendEntry("auto-summary", { title, summary } satisfies SummaryData);
    } catch (e: unknown) {
      model = undefined;
      // Restore deltas for retry on transient errors (API exceptions).
      // Parse failures and empty responses are not retryable.
      consecutiveFailures++;
      if (consecutiveFailures <= MAX_RETRIES) {
        queue.unshift(...deltas);
        if (queue.length > MAX_QUEUE_SIZE) queue.splice(MAX_QUEUE_SIZE);
      }
      return e instanceof Error ? e.message : String(e);
    }
  }

  pi.registerCommand("autoname", {
    description: "Force an immediate session name + summary update",
    handler: async (_args, cmdCtx) => {
      ctx = cmdCtx;
      const messages = cmdCtx.sessionManager
        .getBranch()
        .filter((e): e is { type: "message"; message: { role?: string; content?: unknown } } & typeof e =>
          e.type === "message" && "message" in e,
        )
        .map((e) => e.message);

      const delta = buildDelta(messages, MAX_DELTA_CHARS + MAX_CONTEXT_CHARS);
      if (!delta.trim()) {
        cmdCtx.ui.notify("No conversation to summarize", "warning");
        return;
      }

      const savedTitle = title;
      const savedSummary = summary;
      title = "";
      summary = "";
      queue.length = 0;
      queue.push(delta);
      cmdCtx.ui.notify("Updating session name...", "info");
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      await drainPromise;
      const drainError = await drain();

      if (!title || !summary) {
        title = savedTitle;
        summary = savedSummary;
        const detail = drainError ? `: ${drainError}` : "";
        cmdCtx.ui.notify(`Failed to generate name${detail}`, "warning");
      } else {
        cmdCtx.ui.notify(`Session: ${title}`, "success");
      }
    },
  });

  pi.registerCommand("summary", {
    description: "Show the current rolling session summary",
    handler: async (_args, cmdCtx) => {
      if (!summary) {
        cmdCtx.ui.notify("No summary yet — will generate after the next turn", "info");
        return;
      }
      cmdCtx.ui.notify(`${title}\n\n${summary}`, "info");
    },
  });
}
