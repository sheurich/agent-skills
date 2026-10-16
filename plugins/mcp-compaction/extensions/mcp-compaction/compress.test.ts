import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
	buildToolServerMapFromCache,
	guessServer,
	truncate,
	safeJsonExtract,
	atlassianCompressor,
	pagerdutyCompressor,
	grafanaCompressor,
	googleCompressor,
	compressMcpResult,
	resolveMcpIdentity,
	gatherMcpStats,
	type AgentMessage,
	type ToolServerMap,
} from "./compress.ts";

// ── guessServer ─────────────────────────────────────────────────────

describe("guessServer", () => {
	it("identifies Atlassian tools", () => {
		assert.equal(guessServer("getJiraIssue"), "atlassian");
		assert.equal(guessServer("searchJiraIssuesUsingJql"), "atlassian");
		assert.equal(guessServer("getConfluencePage"), "atlassian");
		assert.equal(guessServer("createConfluencePage"), "atlassian");
		assert.equal(guessServer("atlassianUserInfo"), "atlassian");
		assert.equal(guessServer("editJiraIssue"), "atlassian");
	});

	it("identifies PagerDuty tools", () => {
		assert.equal(guessServer("list_incidents"), "pagerduty");
		assert.equal(guessServer("get_incident"), "pagerduty");
		assert.equal(guessServer("list_oncalls"), "pagerduty");
		assert.equal(guessServer("get_escalation_policy"), "pagerduty");
		assert.equal(guessServer("list_schedules"), "pagerduty");
		assert.equal(guessServer("list_alert_grouping_settings"), "pagerduty");
		assert.equal(guessServer("get_status_page_post"), "pagerduty");
		assert.equal(guessServer("list_log_entries"), "pagerduty");
	});

	it("identifies Grafana tools", () => {
		assert.equal(guessServer("query_loki_logs"), "grafana");
		assert.equal(guessServer("query_prometheus"), "grafana");
		assert.equal(guessServer("search_dashboards"), "grafana");
		assert.equal(guessServer("get_datasource"), "grafana");
		assert.equal(guessServer("get_sift_analysis"), "grafana");
		assert.equal(guessServer("create_annotation"), "grafana");
		assert.equal(guessServer("query_pyroscope"), "grafana");
	});

	it("identifies Google Workspace tools", () => {
		assert.equal(guessServer("gmail_search"), "google-workspace");
		assert.equal(guessServer("calendar_listEvents"), "google-workspace");
		assert.equal(guessServer("drive_search"), "google-workspace");
		assert.equal(guessServer("docs_getText"), "google-workspace");
		assert.equal(guessServer("sheets_getRange"), "google-workspace");
		assert.equal(guessServer("slides_getText"), "google-workspace");
		assert.equal(guessServer("chat_sendMessage"), "google-workspace");
		assert.equal(guessServer("people_getMe"), "google-workspace");
		assert.equal(guessServer("time_getCurrentDate"), "google-workspace");
	});

	it("returns null for unknown tools", () => {
		assert.equal(guessServer("read"), null);
		assert.equal(guessServer("bash"), null);
		assert.equal(guessServer("edit"), null);
		assert.equal(guessServer("my_custom_tool"), null);
	});
});

// ── buildToolServerMapFromCache ─────────────────────────────────────

describe("buildToolServerMapFromCache", () => {
	it("builds map from cache structure", () => {
		const cache = {
			version: 2,
			servers: {
				atlassian: { tools: [{ name: "getJiraIssue" }, { name: "getConfluencePage" }] },
				pagerduty: { tools: [{ name: "list_incidents" }] },
			},
		};
		const map = buildToolServerMapFromCache(cache);
		assert.equal(map.get("getJiraIssue"), "atlassian");
		assert.equal(map.get("getConfluencePage"), "atlassian");
		assert.equal(map.get("list_incidents"), "pagerduty");
		assert.equal(map.get("read"), undefined);
		assert.equal(map.size, 3);
	});

	it("handles empty cache", () => {
		assert.equal(buildToolServerMapFromCache({}).size, 0);
		assert.equal(buildToolServerMapFromCache({ servers: {} }).size, 0);
	});

	it("handles server with no tools", () => {
		const map = buildToolServerMapFromCache({ servers: { empty: {} } });
		assert.equal(map.size, 0);
	});
});

// ── truncate ────────────────────────────────────────────────────────

describe("truncate", () => {
	it("passes through short strings", () => {
		assert.equal(truncate("hello", 10), "hello");
	});

	it("truncates long strings with char count", () => {
		const result = truncate("a".repeat(100), 10);
		assert.ok(result.startsWith("a".repeat(10)));
		assert.ok(result.includes("[truncated 90 chars]"));
	});

	it("handles exact length", () => {
		assert.equal(truncate("abc", 3), "abc");
	});
});

// ── safeJsonExtract ─────────────────────────────────────────────────

describe("safeJsonExtract", () => {
	it("extracts specified fields from object", () => {
		const json = JSON.stringify({ key: "CA-123", summary: "Test", extra: "dropped" });
		const result = safeJsonExtract(json, ["key", "summary"]);
		assert.deepEqual(result, { key: "CA-123", summary: "Test" });
	});

	it("returns null for missing fields", () => {
		const result = safeJsonExtract('{"a": 1}', ["missing"]);
		assert.equal(result, null);
	});

	it("returns null for invalid JSON", () => {
		assert.equal(safeJsonExtract("not json", ["key"]), null);
	});

	it("handles arrays with count and sample", () => {
		const items = [
			{ id: 1, name: "first", big: "x".repeat(400) },
			{ id: 2, name: "second" },
			{ id: 3, name: "third" },
			{ id: 4, name: "fourth" },
		];
		const result = safeJsonExtract(JSON.stringify(items), []);
		assert.ok(result);
		assert.equal(result._count, 4);
		assert.ok(Array.isArray(result._sample));
		assert.equal((result._sample as any[]).length, 3);
		// big field (400 chars > 300 limit) should be stripped
		assert.equal((result._sample as any[])[0].big, undefined);
		assert.equal((result._sample as any[])[0].name, "first");
	});

	it("preserves numeric and boolean fields in array samples", () => {
		const items = [{ count: 42, active: true, label: "test" }];
		const result = safeJsonExtract(JSON.stringify(items), []);
		assert.ok(result);
		const sample = (result._sample as any[])[0];
		assert.equal(sample.count, 42);
		assert.equal(sample.active, true);
		assert.equal(sample.label, "test");
	});
});

// ── Per-server compressors ──────────────────────────────────────────

describe("atlassianCompressor", () => {
	it("extracts Jira key fields", () => {
		const issue = JSON.stringify({
			key: "CA-4567",
			summary: "Fix TLS cert rotation",
			status: { name: "In Progress" },
			assignee: { displayName: "Alice" },
			priority: { name: "High" },
			description: "x".repeat(5000),
			changelog: { histories: [] },
		});
		const result = atlassianCompressor(issue, "getJiraIssue", {});
		assert.ok(result.startsWith("Jira result:"));
		assert.ok(result.includes("CA-4567"));
		assert.ok(result.includes("Fix TLS cert rotation"));
		// Large description and changelog should NOT be present
		assert.ok(!result.includes("x".repeat(100)));
	});

	it("extracts Confluence key fields", () => {
		const page = JSON.stringify({
			id: "12345",
			title: "Runbook: CRL Rotation",
			spaceKey: "CERT",
			version: { number: 5 },
			body: { storage: { value: "<html>" + "x".repeat(10000) + "</html>" } },
		});
		const result = atlassianCompressor(page, "getConfluencePage", {});
		assert.ok(result.startsWith("Confluence result:"));
		assert.ok(result.includes("12345"));
		assert.ok(result.includes("Runbook: CRL Rotation"));
		assert.ok(!result.includes("<html>"));
	});

	it("falls back to truncation for non-JSON", () => {
		const result = atlassianCompressor("plain text " + "x".repeat(2000), "getJiraIssue", {});
		assert.ok(result.includes("[truncated"));
		assert.ok(result.length < 1400);
	});
});

describe("pagerdutyCompressor", () => {
	it("extracts incident key fields", () => {
		const incident = JSON.stringify({
			id: "P12ABC",
			incident_number: 42,
			title: "High CPU on boulder-wfe",
			status: "triggered",
			urgency: "high",
			service: { id: "SVC1", summary: "boulder-wfe" },
			body: { details: "x".repeat(5000) },
			log_entries: [{ type: "trigger" }, { type: "acknowledge" }],
		});
		const result = pagerdutyCompressor(incident, "get_incident", {});
		assert.ok(result.startsWith("PagerDuty result:"));
		assert.ok(result.includes("P12ABC"));
		assert.ok(result.includes("High CPU"));
		assert.ok(!result.includes("log_entries"));
	});
});

describe("grafanaCompressor", () => {
	it("compresses Loki query results", () => {
		const queryResult = JSON.stringify({
			status: "success",
			resultType: "streams",
			data: {
				result: [
					{ stream: { job: "boulder" }, values: [["ts1", "log line 1"]] },
					{ stream: { job: "boulder" }, values: [["ts2", "log line 2"]] },
				],
			},
		});
		const result = grafanaCompressor(queryResult, "query_loki_logs", {});
		assert.ok(result.startsWith("Grafana query result:"));
		assert.ok(result.includes('"_resultCount": 2'));
		assert.ok(result.includes("success"));
	});

	it("compresses dashboard results", () => {
		const dashboard = JSON.stringify({
			uid: "abc123",
			title: "CA Overview",
			url: "/d/abc123/ca-overview",
			tags: ["ca", "production"],
			panels: [{ id: 1 }, { id: 2 }, { id: 3 }],
		});
		const result = grafanaCompressor(dashboard, "get_dashboard_by_uid", {});
		assert.ok(result.startsWith("Grafana dashboard:"));
		assert.ok(result.includes("abc123"));
		assert.ok(result.includes("CA Overview"));
		assert.ok(!result.includes("panels"));
	});
});

describe("googleCompressor", () => {
	it("compresses Gmail results", () => {
		const email = JSON.stringify({
			id: "msg-123",
			threadId: "thread-456",
			from: "alice@example.com",
			to: "bob@example.com",
			subject: "Access Review Q2",
			date: "2026-04-15",
			snippet: "Please review the attached spreadsheet",
			payload: { body: { data: "x".repeat(10000) } },
		});
		const result = googleCompressor(email, "gmail_get", {});
		assert.ok(result.startsWith("Gmail result:"));
		assert.ok(result.includes("msg-123"));
		assert.ok(result.includes("Access Review Q2"));
		assert.ok(!result.includes("payload"));
	});

	it("compresses Calendar results", () => {
		const event = JSON.stringify({
			id: "evt-789",
			summary: "Weekly standup",
			start: { dateTime: "2026-04-15T10:00:00" },
			end: { dateTime: "2026-04-15T10:30:00" },
			status: "confirmed",
			attendees: [{ email: "alice@example.com" }],
			conferenceData: { entryPoints: [] },
		});
		const result = googleCompressor(event, "calendar_getEvent", {});
		assert.ok(result.startsWith("Calendar result:"));
		assert.ok(result.includes("evt-789"));
		assert.ok(result.includes("Weekly standup"));
	});

	it("compresses Drive results", () => {
		const file = JSON.stringify({
			id: "file-abc",
			name: "Q2 Report.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			modifiedTime: "2026-04-10T14:00:00Z",
			webViewLink: "https://docs.google.com/...",
			thumbnailLink: "https://...",
			exportLinks: {},
		});
		const result = googleCompressor(file, "drive_search", {});
		assert.ok(result.startsWith("Drive result:"));
		assert.ok(result.includes("file-abc"));
		assert.ok(result.includes("Q2 Report.docx"));
	});
});

// ── compressMcpResult ───────────────────────────────────────────────

describe("compressMcpResult", () => {
	const toolMap: ToolServerMap = new Map([
		["getJiraIssue", "atlassian"],
		["list_incidents", "pagerduty"],
	]);

	it("compresses direct-mode MCP tool results", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "getJiraIssue",
			content: [{ type: "text", text: JSON.stringify({ key: "CA-1", summary: "Test" }) }],
		};
		const result = compressMcpResult(msg, toolMap);
		assert.ok(result);
		assert.ok(result.startsWith("[MCP atlassian/getJiraIssue]:"));
		assert.ok(result.includes("CA-1"));
	});

	it("compresses gateway-mode MCP tool results (toolName='mcp')", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "mcp",
			content: [{ type: "text", text: JSON.stringify({ key: "CA-99", summary: "Gateway test", status: { name: "Done" } }) }],
			details: { mode: "call", server: "atlassian", tool: "getJiraIssue" },
		};
		const result = compressMcpResult(msg, toolMap);
		assert.ok(result);
		assert.ok(result.startsWith("[MCP atlassian/getJiraIssue]:"));
		assert.ok(result.includes("CA-99"));
	});

	it("handles gateway-mode with tool as object (has .name)", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "mcp",
			content: [{ type: "text", text: JSON.stringify({ id: "P1", title: "Test incident", status: "triggered" }) }],
			details: { mode: "call", server: "pagerduty", tool: { name: "get_incident", originalName: "get_incident" } },
		};
		const result = compressMcpResult(msg, toolMap);
		assert.ok(result);
		assert.ok(result.startsWith("[MCP pagerduty/get_incident]:"));
	});

	it("skips gateway search/describe/list modes", () => {
		for (const mode of ["search", "describe", "list"]) {
			const msg: AgentMessage = {
				role: "toolResult",
				toolName: "mcp",
				content: [{ type: "text", text: "some output" }],
				details: { mode, server: "atlassian", tool: "getJiraIssue" },
			};
			assert.equal(compressMcpResult(msg, toolMap), null, `Should skip mode=${mode}`);
		}
	});

	it("skips gateway call without resolvable tool", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "mcp",
			content: [{ type: "text", text: "Error: something" }],
			details: { mode: "call" },
		};
		assert.equal(compressMcpResult(msg, toolMap), null);
	});

	it("resolves server from map when details.server is missing", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "mcp",
			content: [{ type: "text", text: JSON.stringify({ key: "CA-5", summary: "No server in details" }) }],
			details: { mode: "call", tool: "getJiraIssue" },
		};
		const result = compressMcpResult(msg, toolMap);
		assert.ok(result);
		assert.ok(result.startsWith("[MCP atlassian/getJiraIssue]:"));
	});

	it("returns null for non-MCP tools", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "read",
			content: [{ type: "text", text: "file contents" }],
		};
		assert.equal(compressMcpResult(msg, toolMap), null);
	});

	it("returns null for non-toolResult messages", () => {
		const msg: AgentMessage = { role: "user", content: [{ type: "text", text: "hello" }] };
		assert.equal(compressMcpResult(msg, toolMap), null);
	});

	it("returns null for empty content", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "mcp",
			content: [],
			details: { mode: "call", server: "atlassian", tool: "getJiraIssue" },
		};
		assert.equal(compressMcpResult(msg, toolMap), null);
	});

	it("uses guessServer as fallback for direct-mode tools not in map", () => {
		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "query_loki_logs",
			content: [{ type: "text", text: JSON.stringify({ status: "success", resultType: "streams" }) }],
		};
		const result = compressMcpResult(msg, new Map());
		assert.ok(result);
		assert.ok(result.startsWith("[MCP grafana/query_loki_logs]:"));
	});
});

// ── resolveMcpIdentity ──────────────────────────────────────────────

describe("resolveMcpIdentity", () => {
	const toolMap: ToolServerMap = new Map([
		["getJiraIssue", "atlassian"],
		["list_oncalls", "pagerduty"],
	]);

	it("resolves gateway call with server and tool string", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "call", server: "pagerduty", tool: "list_oncalls" },
		};
		const id = resolveMcpIdentity(msg, toolMap);
		assert.deepEqual(id, { server: "pagerduty", tool: "list_oncalls" });
	});

	it("resolves gateway call with tool as object", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "call", server: "atlassian", tool: { name: "getJiraIssue", originalName: "getJiraIssue" } },
		};
		const id = resolveMcpIdentity(msg, toolMap);
		assert.deepEqual(id, { server: "atlassian", tool: "getJiraIssue" });
	});

	it("resolves server from toolMap when details.server missing", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "call", tool: "getJiraIssue" },
		};
		const id = resolveMcpIdentity(msg, toolMap);
		assert.deepEqual(id, { server: "atlassian", tool: "getJiraIssue" });
	});

	it("resolves server from guessServer when not in map", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "call", tool: "query_loki_logs" },
		};
		const id = resolveMcpIdentity(msg, new Map());
		assert.deepEqual(id, { server: "grafana", tool: "query_loki_logs" });
	});

	it("returns null for search mode", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "search" },
		};
		assert.equal(resolveMcpIdentity(msg, toolMap), null);
	});

	it("returns null for describe mode", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "describe", server: "atlassian", tool: "getJiraIssue" },
		};
		assert.equal(resolveMcpIdentity(msg, toolMap), null);
	});

	it("returns null for call mode without resolvable tool", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "mcp",
			details: { mode: "call" },
		};
		assert.equal(resolveMcpIdentity(msg, toolMap), null);
	});

	it("resolves direct-mode tools (non-gateway)", () => {
		const msg: AgentMessage = {
			role: "toolResult", toolName: "getJiraIssue",
		};
		const id = resolveMcpIdentity(msg, toolMap);
		assert.deepEqual(id, { server: "atlassian", tool: "getJiraIssue" });
	});

	it("returns null for non-MCP tools", () => {
		const msg: AgentMessage = { role: "toolResult", toolName: "read" };
		assert.equal(resolveMcpIdentity(msg, toolMap), null);
	});

	it("returns null for non-toolResult", () => {
		const msg: AgentMessage = { role: "user" };
		assert.equal(resolveMcpIdentity(msg, toolMap), null);
	});
});

// ── gatherMcpStats ──────────────────────────────────────────────────

describe("gatherMcpStats", () => {
	const toolMap: ToolServerMap = new Map([
		["getJiraIssue", "atlassian"],
		["searchJiraIssuesUsingJql", "atlassian"],
		["list_incidents", "pagerduty"],
		["list_oncalls", "pagerduty"],
	]);

	it("tallies calls and bytes per server (direct mode)", () => {
		const messages: AgentMessage[] = [
			{ role: "user", content: [{ type: "text", text: "hello" }] },
			{ role: "toolResult", toolName: "getJiraIssue", content: [{ type: "text", text: "a".repeat(1024) }] },
			{ role: "toolResult", toolName: "searchJiraIssuesUsingJql", content: [{ type: "text", text: "b".repeat(2048) }] },
			{ role: "toolResult", toolName: "list_incidents", content: [{ type: "text", text: "c".repeat(512) }] },
			{ role: "toolResult", toolName: "read", content: [{ type: "text", text: "ignored" }] },
		];
		const stats = gatherMcpStats(messages, toolMap);
		assert.ok(stats.includes("atlassian: 2 calls (~3KB)"));
		assert.ok(stats.includes("pagerduty: 1 calls (~1KB)"));
		// Built-in tool "read" should not appear
		assert.ok(!stats.includes("read"));
	});

	it("tallies calls for gateway mode (toolName='mcp')", () => {
		const messages: AgentMessage[] = [
			{
				role: "toolResult", toolName: "mcp",
				content: [{ type: "text", text: "x".repeat(5000) }],
				details: { mode: "call", server: "pagerduty", tool: "list_oncalls" },
			},
			{
				role: "toolResult", toolName: "mcp",
				content: [{ type: "text", text: "y".repeat(3000) }],
				details: { mode: "call", server: "atlassian", tool: "getJiraIssue" },
			},
			// search mode — should be excluded
			{
				role: "toolResult", toolName: "mcp",
				content: [{ type: "text", text: "z".repeat(10000) }],
				details: { mode: "search" },
			},
		];
		const stats = gatherMcpStats(messages, toolMap);
		assert.ok(stats.includes("pagerduty: 1 calls (~5KB)"));
		assert.ok(stats.includes("atlassian: 1 calls (~3KB)"));
		// search mode should not appear
		assert.ok(!stats.includes("10KB"));
	});

	it("returns empty string for no MCP messages", () => {
		const messages: AgentMessage[] = [
			{ role: "user", content: [{ type: "text", text: "hello" }] },
			{ role: "toolResult", toolName: "bash", content: [{ type: "text", text: "output" }] },
		];
		assert.equal(gatherMcpStats(messages, toolMap), "");
	});
});

// ── Compression ratio ───────────────────────────────────────────────

describe("compression effectiveness", () => {
	const toolMap: ToolServerMap = new Map([["getJiraIssue", "atlassian"]]);

	it("significantly reduces a realistic Jira issue", () => {
		const bigIssue = JSON.stringify({
			key: "CA-9999",
			summary: "Rotate HSM keys for WAS18",
			status: { name: "In Progress", id: "3" },
			assignee: { displayName: "Shiloh", accountId: "abc123", emailAddress: "s@example.com" },
			reporter: { displayName: "Alice", accountId: "def456" },
			priority: { name: "Critical", id: "1" },
			issuetype: { name: "Task" },
			description: "Detailed description: " + "lorem ipsum ".repeat(500),
			comment: {
				comments: Array.from({ length: 20 }, (_, i) => ({
					id: `c${i}`,
					body: "Comment body ".repeat(50),
					author: { displayName: `User ${i}` },
				})),
			},
			changelog: { histories: Array.from({ length: 30 }, () => ({ items: [{ field: "status" }] })) },
			fields: { customfield_10001: "x".repeat(2000) },
			renderedFields: { description: "<div>" + "x".repeat(3000) + "</div>" },
		});

		const msg: AgentMessage = {
			role: "toolResult",
			toolName: "getJiraIssue",
			content: [{ type: "text", text: bigIssue }],
		};

		const result = compressMcpResult(msg, toolMap)!;
		assert.ok(result);
		const ratio = result.length / bigIssue.length;
		assert.ok(ratio < 0.1, `Expected >10x compression, got ${(1 / ratio).toFixed(1)}x (${result.length} vs ${bigIssue.length} chars)`);
		// Key fields preserved
		assert.ok(result.includes("CA-9999"));
		assert.ok(result.includes("Rotate HSM keys"));
	});
});
