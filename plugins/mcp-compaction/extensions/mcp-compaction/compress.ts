/**
 * Pure functions for MCP result compression.
 * Exported for testing — no Pi or MCP runtime dependencies.
 */

// ── Types ───────────────────────────────────────────────────────────

export type ToolServerMap = Map<string, string>;

export type Compressor = (text: string, toolName: string, args: Record<string, unknown>) => string;

export interface AgentMessage {
	role: string;
	toolCallId?: string;
	toolName?: string;
	content?: any;
	details?: any;
	timestamp?: number;
}

/** Result of resolving the actual MCP tool name and server from a message. */
export interface McpIdentity {
	server: string;
	tool: string;
}

export interface McpCache {
	version?: number;
	servers?: Record<string, { tools?: { name: string }[] }>;
}

// ── Tool-to-server mapping ──────────────────────────────────────────

/** Build a tool→server map from a parsed MCP cache object. */
export function buildToolServerMapFromCache(cache: McpCache): ToolServerMap {
	const map: ToolServerMap = new Map();
	for (const [server, data] of Object.entries(cache.servers ?? {})) {
		for (const tool of data.tools ?? []) {
			map.set(tool.name, server);
		}
	}
	return map;
}

/** Fallback heuristic when cache is unavailable. */
export function guessServer(toolName: string): string | null {
	const lower = toolName.toLowerCase();
	if (/^(get|search|create|update|edit|add)?(confluence|jira|atlassian)/i.test(toolName)) return "atlassian";
	if (lower.includes("jira") || lower.includes("confluence")) return "atlassian";
	if (/incident|oncall|escalation|schedule|alert_grouping|status_page|log_entr/i.test(toolName)) return "pagerduty";
	if (/grafana|loki|prometheus|pyroscope|dashboard|datasource|sift|annotation/i.test(toolName)) return "grafana";
	if (/gmail|calendar|drive|docs_|sheets_|slides_|chat_|people_|time_/i.test(toolName)) return "google-workspace";
	return null;
}

// ── Utilities ───────────────────────────────────────────────────────

export function truncate(s: string, max: number): string {
	return s.length <= max ? s : s.slice(0, max) + `\n... [truncated ${s.length - max} chars]`;
}

/** Extract key fields from a JSON blob. Returns null on parse failure or empty extraction. */
export function safeJsonExtract(text: string, fields: string[]): Record<string, unknown> | null {
	try {
		const obj = JSON.parse(text);
		const extracted: Record<string, unknown> = {};
		for (const f of fields) {
			if (obj[f] !== undefined) extracted[f] = obj[f];
		}
		if (Array.isArray(obj)) {
			extracted._count = obj.length;
			extracted._sample = obj.slice(0, 3).map((item: any) => {
				if (typeof item === "object" && item !== null) {
					const slim: Record<string, unknown> = {};
					for (const [k, v] of Object.entries(item)) {
						if (typeof v === "string" && v.length < 300) slim[k] = v;
						else if (typeof v === "number" || typeof v === "boolean") slim[k] = v;
					}
					return slim;
				}
				return item;
			});
		}
		return Object.keys(extracted).length > 0 ? extracted : null;
	} catch {
		return null;
	}
}

// ── Per-server compressors ──────────────────────────────────────────

export const atlassianCompressor: Compressor = (text, toolName, _args) => {
	if (/jira/i.test(toolName)) {
		const obj = safeJsonExtract(text, [
			"key", "summary", "status", "assignee", "reporter", "priority",
			"issuetype", "created", "updated", "resolution", "labels", "components",
		]);
		if (obj) return `Jira result: ${JSON.stringify(obj, null, 1)}`;
	}
	if (/confluence/i.test(toolName)) {
		const obj = safeJsonExtract(text, [
			"id", "title", "spaceKey", "version", "status", "_links",
		]);
		if (obj) return `Confluence result: ${JSON.stringify(obj, null, 1)}`;
	}
	return truncate(text, 1200);
};

export const pagerdutyCompressor: Compressor = (text, _toolName, _args) => {
	const obj = safeJsonExtract(text, [
		"id", "incident_number", "title", "status", "urgency", "service",
		"escalation_policy", "created_at", "updated_at", "resolved_at",
		"assignees", "teams", "description",
	]);
	if (obj) return `PagerDuty result: ${JSON.stringify(obj, null, 1)}`;
	return truncate(text, 1200);
};

export const grafanaCompressor: Compressor = (text, toolName, _args) => {
	if (/query_loki|query_prometheus|query_pyroscope/i.test(toolName)) {
		const obj = safeJsonExtract(text, ["status", "resultType"]);
		if (obj) {
			try {
				const parsed = JSON.parse(text);
				const results = parsed.data?.result ?? parsed.results ?? [];
				obj._resultCount = Array.isArray(results) ? results.length : "unknown";
				if (Array.isArray(results) && results.length > 0) {
					obj._firstResult = JSON.stringify(results[0]).slice(0, 500);
				}
			} catch { /* keep what we have */ }
			return `Grafana query result: ${JSON.stringify(obj, null, 1)}`;
		}
	}
	if (/dashboard/i.test(toolName)) {
		const obj = safeJsonExtract(text, ["uid", "title", "url", "tags", "folderTitle"]);
		if (obj) return `Grafana dashboard: ${JSON.stringify(obj, null, 1)}`;
	}
	return truncate(text, 1200);
};

export const googleCompressor: Compressor = (text, toolName, _args) => {
	if (/gmail/i.test(toolName)) {
		const obj = safeJsonExtract(text, [
			"id", "threadId", "from", "to", "subject", "date", "snippet", "labelIds",
		]);
		if (obj) return `Gmail result: ${JSON.stringify(obj, null, 1)}`;
	}
	if (/calendar/i.test(toolName)) {
		const obj = safeJsonExtract(text, [
			"id", "summary", "start", "end", "status", "attendees", "location",
		]);
		if (obj) return `Calendar result: ${JSON.stringify(obj, null, 1)}`;
	}
	if (/drive/i.test(toolName)) {
		const obj = safeJsonExtract(text, [
			"id", "name", "mimeType", "modifiedTime", "owners", "webViewLink",
		]);
		if (obj) return `Drive result: ${JSON.stringify(obj, null, 1)}`;
	}
	return truncate(text, 1200);
};

export const compressors: Record<string, Compressor> = {
	atlassian: atlassianCompressor,
	pagerduty: pagerdutyCompressor,
	grafana: grafanaCompressor,
	"google-workspace": googleCompressor,
};

// ── Message-level operations ────────────────────────────────────────

/**
 * Resolve the actual MCP server and tool name from a message.
 *
 * The pi-mcp-adapter registers a single gateway tool called "mcp".
 * The actual tool name and server live in details.tool / details.server
 * for successful calls, or can be inferred from the tool-server map.
 *
 * For non-gateway MCP tools (direct mode with prefixed names), falls back
 * to checking toolServerMap and guessServer against toolName directly.
 */
export function resolveMcpIdentity(
	msg: AgentMessage,
	toolServerMap: ToolServerMap,
): McpIdentity | null {
	if (msg.role !== "toolResult" || !msg.toolName) return null;

	const details = msg.details;

	// Gateway mode: toolName === "mcp", actual identity in details
	if (msg.toolName === "mcp" && details && typeof details === "object") {
		const mode = details.mode;
		// Only compress actual tool call results, not search/describe/list
		if (mode !== "call") return null;

		let tool = details.tool;
		if (typeof tool === "object" && tool !== null) tool = tool.name;
		if (typeof tool !== "string" || !tool) return null;

		let server = details.server;
		if (typeof server !== "string" || !server) {
			// Try to resolve from map or heuristic
			server = toolServerMap.get(tool) ?? guessServer(tool);
		}
		if (!server) return null;

		return { server, tool };
	}

	// Direct mode: prefixed tool names (e.g., atlassian_getJiraIssue)
	const server = toolServerMap.get(msg.toolName) ?? guessServer(msg.toolName);
	if (!server) return null;
	return { server, tool: msg.toolName };
}

/** Compress a single MCP tool result message. Returns null if not an MCP tool. */
export function compressMcpResult(
	msg: AgentMessage,
	toolServerMap: ToolServerMap,
): string | null {
	const identity = resolveMcpIdentity(msg, toolServerMap);
	if (!identity) return null;

	const textParts: string[] = [];
	if (Array.isArray(msg.content)) {
		for (const block of msg.content) {
			if (block?.type === "text" && typeof block.text === "string") {
				textParts.push(block.text);
			}
		}
	}
	const text = textParts.join("\n");
	if (!text) return null;

	const compressor = compressors[identity.server];
	const compressed = compressor ? compressor(text, identity.tool, msg.details ?? {}) : truncate(text, 1200);

	return `[MCP ${identity.server}/${identity.tool}]: ${compressed}`;
}

/** Gather per-server MCP usage statistics from a message array. */
export function gatherMcpStats(messages: AgentMessage[], toolServerMap: ToolServerMap): string {
	const byServer: Record<string, { calls: number; totalChars: number; tools: Set<string> }> = {};

	for (const msg of messages) {
		const identity = resolveMcpIdentity(msg, toolServerMap);
		if (!identity) continue;

		if (!byServer[identity.server]) byServer[identity.server] = { calls: 0, totalChars: 0, tools: new Set() };
		byServer[identity.server].calls++;
		byServer[identity.server].tools.add(identity.tool);

		if (Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block?.type === "text") byServer[identity.server].totalChars += (block.text?.length ?? 0);
			}
		}
	}

	return Object.entries(byServer)
		.map(([server, stats]) =>
			`- ${server}: ${stats.calls} calls (~${Math.round(stats.totalChars / 1024)}KB), tools: ${[...stats.tools].join(", ")}`)
		.join("\n");
}
