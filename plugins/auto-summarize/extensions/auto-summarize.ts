/**
 * Auto-Summarize Extension
 *
 * Maintains a rolling session summary and title in the background.
 * After each agent turn, sends the conversation delta to a cheap model
 * and persists the result as a custom session entry.
 *
 * Commands:
 *   /summary   - show the current summary
 *   /autoname  - force a full re-summarize from the entire branch
 */

import { complete, type Api, type Model } from "@mariozechner/pi-ai";
import type { CustomEntry, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

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
const MAX_QUEUE_SIZE = 50;

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : s.slice(0, max - 12) + "\n[truncated]";

const truncateTail = (s: string, max: number): string =>
  s.length <= max ? s : "[truncated]\n" + s.slice(s.length - max + 12);

const SUMMARIZE_PROMPT = `\
You maintain a rolling summary of a coding agent session.
Given the current summary and the latest turn, produce an updated summary and a short title.

Rules:
- The summary captures goals, key decisions, progress, and next steps.
- The summary is concise: 3-8 bullet points, not prose paragraphs.
- The title is ≤72 characters, lowercase, format: \`topic: what happened\`.
- If the session just started, derive both from the turn alone.
- Drop stale information that has been superseded.

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

function buildDelta(messages: Array<{ role?: string; content?: unknown }>): string {
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
  return truncateTail(parts.join("\n\n"), MAX_DELTA_CHARS);
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

/** Try known cheap models in preference order. */
function findModel(ctx: ExtensionContext): Model<Api> | undefined {
  // Prefer Bedrock ARN over direct Anthropic (custom inference profiles).
  const all = ctx.modelRegistry.getAll();
  const bedrock = all.find((m) => m.id.includes("haiku-4-5") && m.id.startsWith("arn:"));
  if (bedrock) return bedrock;

  return (
    ctx.modelRegistry.find("anthropic", "claude-haiku-4-5") ??
    ctx.modelRegistry.find("openai", "gpt-5.4-mini")
  );
}

export default function (pi: ExtensionAPI) {
  let summary = "";
  let title = "";
  let ctx: ExtensionContext | null = null; // cached for background drains
  let model: Model<Api> | undefined;
  const queue: string[] = [];
  let drainPromise = Promise.resolve();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  pi.on("session_start", async (_event, newCtx) => {
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
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      drainPromise = drainPromise
        .then(() => (queue.length > 0 ? drain() : undefined))
        .catch(() => {});
    }, 3000);
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

  async function drain() {
    if (!ctx || queue.length === 0) return;

    const m = model ?? (model = findModel(ctx));
    if (!m) return;

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(m);
    if (!auth.ok || !auth.apiKey) return;

    // Consume queue only after confirming model + auth are available.
    const deltas = queue.splice(0);
    const combined = truncate(deltas.join("\n---\n"), MAX_DELTA_CHARS);

    const prompt = `${SUMMARIZE_PROMPT}

## Current summary
${summary || "(new session — no summary yet)"}

## ${deltas.length > 1 ? `Latest turns (${deltas.length} combined)` : "Latest turn"}
${combined}`;

    try {
      const response = await complete(
        m,
        { messages: [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }], timestamp: Date.now() }] },
        { apiKey: auth.apiKey, headers: auth.headers },
      );

      const text = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");

      const parsed = parseJson(text);
      if (!parsed) return;

      if (parsed.title) {
        title = parsed.title;
        pi.setSessionName(title);
      }
      if (parsed.summary) {
        summary = parsed.summary;
      }
      pi.appendEntry("auto-summary", { title, summary } satisfies SummaryData);
    } catch {
      // Background task — never disrupt the session.
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

      const delta = buildDelta(messages);
      if (!delta.trim()) {
        cmdCtx.ui.notify("No conversation to summarize", "warning");
        return;
      }

      const savedTitle = title;
      const savedSummary = summary;
      title = "";
      summary = "";
      queue.push(delta);
      cmdCtx.ui.notify("Updating session name...", "info");
      drainNow();
      await drainPromise;

      if (!title || !summary) {
        title = savedTitle;
        summary = savedSummary;
        cmdCtx.ui.notify("Failed to generate name", "warning");
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
