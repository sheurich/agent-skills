import { complete } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type ContentBlock = {
	type?: string;
	text?: string;
	name?: string;
	arguments?: Record<string, unknown>;
};

type AgentEndMessage = {
	role?: string;
	content?: unknown;
};

/** Extract text from a message content field. */
const extractText = (content: unknown): string => {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return (content as ContentBlock[])
		.filter((b) => b.type === "text" && typeof b.text === "string")
		.map((b) => b.text!)
		.join("\n");
};

/** Extract tool call signatures from assistant content. */
const extractToolCalls = (content: unknown): string[] => {
	if (!Array.isArray(content)) return [];
	return (content as ContentBlock[])
		.filter((b) => b.type === "toolCall" && typeof b.name === "string")
		.map((b) => {
			const args = b.arguments ?? {};
			const brief = Object.entries(args)
				.slice(0, 3)
				.map(([k, v]) => {
					const s = typeof v === "string" ? v : JSON.stringify(v);
					return `${k}=${s.length > 80 ? s.slice(0, 77) + "..." : s}`;
				})
				.join(", ");
			return `[tool: ${b.name}(${brief})]`;
		});
};

/** Build a concise delta string from the messages produced in one agent turn. */
const buildTurnDelta = (messages: AgentEndMessage[]): string => {
	const parts: string[] = [];
	for (const msg of messages) {
		if (!msg.role) continue;
		if (msg.role === "user") {
			const text = extractText(msg.content).trim();
			if (text) parts.push(`User: ${text}`);
		} else if (msg.role === "assistant") {
			const text = extractText(msg.content).trim();
			if (text) parts.push(`Assistant: ${text}`);
			const tools = extractToolCalls(msg.content);
			if (tools.length > 0) parts.push(tools.join("\n"));
		}
	}
	return parts.join("\n\n");
};

const SUMMARIZE_PROMPT = [
	"You maintain a rolling summary of a coding agent session.",
	"Given the current summary and the latest turn, produce an updated summary and a short title.",
	"",
	"Rules:",
	"- The summary captures goals, key decisions, progress, and next steps.",
	"- The summary is concise: 3-8 bullet points, not prose paragraphs.",
	"- The title is ≤72 characters, lowercase, format: `topic: what happened`.",
	"- If the session just started, derive both from the turn alone.",
	"- Drop stale information that has been superseded.",
	"",
	"Respond with ONLY a JSON object (no markdown fences):",
	'{"title": "...", "summary": "..."}',
].join("\n");

/** Parse JSON from LLM output, tolerating markdown fences and array summaries. */
function parseJson(text: string): { title?: string; summary?: string } | null {
	try {
		const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "");
		const obj = JSON.parse(cleaned);
		// Normalize summary: Haiku sometimes returns an array of bullet points.
		if (Array.isArray(obj.summary)) {
			obj.summary = obj.summary.map((s: string) => `- ${s}`).join("\n");
		}
		return obj;
	} catch {
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	let currentSummary = "";
	let currentTitle = "";
	let storedCtx: ExtensionContext | null = null;
	let cachedModel: any = null;
	const deltaQueue: string[] = [];
	let draining = false;

	// --- Lifecycle ---

	pi.on("session_start", async (_event, ctx) => {
		storedCtx = ctx;
		cachedModel = null;
		currentSummary = "";
		currentTitle = "";

		// Restore state from the most recent auto-summary entry on this branch.
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && (entry as any).customType === "auto-summary") {
				const data = (entry as any).data;
				currentSummary = data?.summary ?? "";
				currentTitle = data?.title ?? "";
			}
		}
	});

	// Queue a delta after every agent turn.
	pi.on("agent_end", async (event) => {
		const delta = buildTurnDelta(event.messages as AgentEndMessage[]);
		if (!delta.trim()) return;
		deltaQueue.push(delta);
		scheduleDrain();
	});

	// --- Background drain loop ---

	function scheduleDrain() {
		if (draining) return;
		draining = true;
		// Detach from the event handler — don't block the agent.
		void drain().finally(() => {
			draining = false;
			if (deltaQueue.length > 0) scheduleDrain();
		});
	}

	async function drain() {
		const deltas = deltaQueue.splice(0);
		if (deltas.length === 0) return;

		const combined = deltas.join("\n---\n");
		const prompt = [
			SUMMARIZE_PROMPT,
			"",
			"## Current summary",
			currentSummary || "(new session — no summary yet)",
			"",
			deltas.length > 1 ? `## Latest turns (${deltas.length} combined)` : "## Latest turn",
			combined,
		].join("\n");

		try {
			const model = findHaikuModel();
			if (!model) return;

			const auth = await getAuth(model);
			if (!auth) return;

			const response = await complete(
				model,
				{
					messages: [
						{
							role: "user" as const,
							content: [{ type: "text" as const, text: prompt }],
							timestamp: Date.now(),
						},
					],
				},
				{
					apiKey: auth.apiKey,
					headers: auth.headers,
				},
			);

			const text = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("");

			const parsed = parseJson(text);
			if (!parsed) return;

			if (parsed.title) {
				currentTitle = parsed.title;
				pi.setSessionName(currentTitle);
			}
			if (parsed.summary) {
				currentSummary = parsed.summary;
			}
			pi.appendEntry("auto-summary", { title: currentTitle, summary: currentSummary });
		} catch {
			// Silent failure — don't disrupt the session for a background task.
		}
	}

	// --- Model resolution ---

	/** Model ID substring to search for. Prefer the custom Bedrock inference profile. */
	const MODEL_SEARCH = "haiku-4-5";

	function findHaikuModel(): any {
		if (cachedModel) return cachedModel;
		if (!storedCtx) return null;

		try {
			const all = storedCtx.modelRegistry.getAll();
			// Prefer ARN (custom inference profile) over built-in ID.
			const matches = all.filter((m: any) => (m.id ?? "").includes(MODEL_SEARCH));
			cachedModel = matches.find((m: any) => m.id.startsWith("arn:")) ?? matches[0] ?? null;
		} catch {
			// Fall through.
		}
		return cachedModel;
	}

	async function getAuth(model: any): Promise<{ apiKey?: string; headers?: Record<string, string> } | null> {
		if (!storedCtx) return null;
		const auth = await storedCtx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) return null;
		return { apiKey: auth.apiKey, headers: auth.headers };
	}

	// --- Commands ---

	pi.registerCommand("autoname", {
		description: "Force an immediate session name + summary update",
		handler: async (_args, ctx) => {
			storedCtx = ctx;
			const branch = ctx.sessionManager.getBranch();
			const messages = branch
				.filter((e: any) => e.type === "message" && e.message)
				.map((e: any) => e.message);
			const delta = buildTurnDelta(messages);
			if (!delta.trim()) {
				ctx.ui.notify("No conversation to summarize", "warning");
				return;
			}
			// Full re-summarize: clear current summary so Haiku sees the whole conversation.
			const savedSummary = currentSummary;
			currentSummary = "";
			deltaQueue.push(delta);
			ctx.ui.notify("Updating session name...", "info");
			await drain();
			if (!currentTitle) {
				currentSummary = savedSummary;
				ctx.ui.notify("Failed to generate name", "warning");
			} else {
				ctx.ui.notify(`Session: ${currentTitle}`, "success");
			}
		},
	});

	pi.registerCommand("summary", {
		description: "Show the current rolling session summary",
		handler: async (_args, ctx) => {
			if (!currentSummary) {
				ctx.ui.notify("No summary yet — will generate after the next turn", "info");
				return;
			}
			ctx.ui.notify(`${currentTitle}\n\n${currentSummary}`, "info");
		},
	});
}
