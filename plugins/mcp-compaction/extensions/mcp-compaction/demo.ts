/**
 * Demo: MCP compression ratios on realistic service payloads.
 *
 * Run: node --experimental-strip-types demo.ts
 *
 * No Pi runtime or API keys required — exercises only the pure compression layer.
 */

import {
	compressMcpResult,
	gatherMcpStats,
	type AgentMessage,
	type ToolServerMap,
} from "./compress.ts";

// ── Realistic MCP payloads ──────────────────────────────────────────

const toolMap: ToolServerMap = new Map([
	["getJiraIssue", "atlassian"],
	["searchJiraIssuesUsingJql", "atlassian"],
	["getConfluencePage", "atlassian"],
	["list_incidents", "pagerduty"],
	["get_incident", "pagerduty"],
	["list_oncalls", "pagerduty"],
	["query_loki_logs", "grafana"],
	["search_dashboards", "grafana"],
	["get_dashboard_by_uid", "grafana"],
	["gmail_search", "google-workspace"],
	["gmail_get", "google-workspace"],
	["calendar_listEvents", "google-workspace"],
]);

function jiraIssue(key: string, summary: string): string {
	return JSON.stringify({
		key,
		id: "10042",
		self: `https://company.atlassian.net/rest/api/3/issue/${key}`,
		summary,
		status: { name: "In Progress", id: "3", statusCategory: { name: "In Progress", id: 4 } },
		assignee: { displayName: "Shiloh Heurich", accountId: "abc123def456", emailAddress: "sheurich@example.com", active: true },
		reporter: { displayName: "Alice Smith", accountId: "ghi789jkl012", emailAddress: "alice@example.com" },
		priority: { name: "Critical", id: "1", iconUrl: "https://company.atlassian.net/images/icons/priorities/critical.svg" },
		issuetype: { name: "Task", id: "10001", subtask: false, iconUrl: "https://company.atlassian.net/..." },
		created: "2026-04-10T09:15:00.000-0700",
		updated: "2026-04-14T16:45:00.000-0700",
		resolution: null,
		labels: ["ca-operations", "hsm", "p0"],
		components: [{ name: "HSM Management" }],
		description: {
			type: "doc", version: 1,
			content: Array.from({ length: 20 }, (_, i) => ({
				type: "paragraph",
				content: [{ type: "text", text: `Step ${i + 1}: Perform the key rotation procedure for partition ${i}. Ensure the backup HSM is synchronized before proceeding. Verify key material integrity using the checksum tool. Document the serial numbers of all tokens used.` }],
			})),
		},
		comment: {
			comments: Array.from({ length: 15 }, (_, i) => ({
				id: `comment-${i}`,
				author: { displayName: `User ${i % 5}`, accountId: `user${i % 5}` },
				body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: `Comment ${i}: Updated status — partition ${i} rotation complete. Verified checksums match. Moving to next partition. CC @security for audit trail.` }] }] },
				created: `2026-04-${10 + Math.floor(i / 3)}T${9 + i}:00:00.000-0700`,
				updated: `2026-04-${10 + Math.floor(i / 3)}T${9 + i}:30:00.000-0700`,
			})),
			total: 15,
		},
		changelog: {
			histories: Array.from({ length: 25 }, (_, i) => ({
				id: `history-${i}`,
				author: { displayName: "Automation" },
				created: `2026-04-${10 + Math.floor(i / 5)}T12:00:00.000-0700`,
				items: [{ field: "status", fromString: "To Do", toString: "In Progress" }],
			})),
		},
		fields: {
			customfield_10001: "Change Request",
			customfield_10050: { value: "Production" },
			customfield_10051: "2026-04-15T00:00:00.000-0700",
			customfield_10099: "x".repeat(3000),
		},
		renderedFields: {
			description: "<div>" + "<p>Rendered paragraph. </p>".repeat(20) + "</div>",
			comment: { comments: [{ body: "<p>Rendered comment</p>".repeat(15) }] },
		},
	});
}

function confluencePage(): string {
	return JSON.stringify({
		id: "786432",
		type: "page",
		title: "Runbook: HSM Key Rotation Procedure",
		status: "current",
		spaceKey: "CERT",
		version: { number: 12, when: "2026-03-20T10:00:00.000Z", by: { displayName: "Alice" } },
		_links: { webui: "/spaces/CERT/pages/786432", self: "https://company.atlassian.net/wiki/rest/api/content/786432" },
		body: {
			storage: {
				value: `<h1>HSM Key Rotation</h1>${"<p>Detailed procedure step with code examples and configuration snippets. ".repeat(100)}${Array.from({ length: 10 }, (_, i) => `<table><tr><th>Partition ${i}</th><th>Serial</th><th>Status</th></tr>${Array.from({ length: 5 }, (_, j) => `<tr><td>P${i}-${j}</td><td>SN-${Math.random().toString(36).slice(2, 10)}</td><td>Active</td></tr>`).join("")}</table>`).join("")}</p>`,
			},
		},
		ancestors: [{ id: "100", title: "Operations" }, { id: "200", title: "Runbooks" }],
		children: { page: { results: Array.from({ length: 8 }, (_, i) => ({ id: `sub-${i}`, title: `Sub-procedure ${i}` })) } },
		metadata: { labels: { results: [{ name: "hsm" }, { name: "operations" }, { name: "runbook" }] } },
	});
}

function pagerdutyIncident(): string {
	return JSON.stringify({
		id: "P7QR2XY",
		incident_number: 1847,
		title: "High error rate on boulder-wfe in WAS18",
		status: "triggered",
		urgency: "high",
		service: { id: "PSVC001", summary: "boulder-wfe", html_url: "https://company.pagerduty.com/services/PSVC001" },
		escalation_policy: { id: "PESC001", summary: "CA On-Call" },
		created_at: "2026-04-15T14:30:00Z",
		updated_at: "2026-04-15T14:35:00Z",
		resolved_at: null,
		assignees: [{ assignee: { id: "PUSR001", summary: "Shiloh Heurich" } }],
		teams: [{ id: "PTEAM01", summary: "Certainly" }],
		description: "Error rate exceeded 5% threshold. boulder-wfe instances in WAS18 returning 503 on /acme/new-order. " + "Additional diagnostic context. ".repeat(50),
		body: { type: "incident_body", details: "Full incident details with timeline and automated diagnostics.\n".repeat(30) },
		pending_actions: Array.from({ length: 5 }, (_, i) => ({ type: "escalate", at: `2026-04-15T${15 + i}:00:00Z` })),
		acknowledgements: [{ at: "2026-04-15T14:32:00Z", acknowledger: { summary: "Shiloh" } }],
		log_entries: Array.from({ length: 20 }, (_, i) => ({
			id: `log-${i}`,
			type: i % 3 === 0 ? "trigger_log_entry" : "acknowledge_log_entry",
			created_at: `2026-04-15T14:${30 + i}:00Z`,
			agent: { summary: "Monitoring Service" },
			channel: { type: "auto" },
		})),
		alert_counts: { all: 12, triggered: 8, resolved: 4 },
		conference_bridge: { id: "CB001", summary: "War room" },
	});
}

function lokiQueryResult(): string {
	return JSON.stringify({
		status: "success",
		resultType: "streams",
		data: {
			result: Array.from({ length: 50 }, (_, i) => ({
				stream: {
					job: "boulder-wfe",
					instance: `boulder-wfe-${i % 5}.was18.example.com:8080`,
					level: i % 4 === 0 ? "error" : "info",
					namespace: "ca-production",
				},
				values: Array.from({ length: 20 }, (_, j) => [
					`${Date.now() - (i * 20 + j) * 1000}000000`,
					`${new Date().toISOString()} level=${i % 4 === 0 ? "error" : "info"} msg="Request processed" method=POST path=/acme/new-order status=${i % 4 === 0 ? 503 : 200} duration=${Math.random() * 500}ms client=10.${i}.${j}.1 requestId=req-${Math.random().toString(36).slice(2, 10)}`,
				]),
			})),
			stats: {
				summary: { bytesProcessedPerSecond: 15000000, totalBytesProcessed: 45000000, execTime: 3.2 },
				ingester: { totalReached: 12, totalChunksMatched: 340 },
			},
		},
	});
}

function grafanaDashboard(): string {
	return JSON.stringify({
		uid: "ca-overview-v3",
		title: "CA Production Overview",
		url: "/d/ca-overview-v3/ca-production-overview",
		tags: ["ca", "production", "boulder"],
		folderTitle: "Certainly",
		panels: Array.from({ length: 15 }, (_, i) => ({
			id: i,
			title: `Panel ${i}`,
			type: "graph",
			datasource: "prometheus",
			targets: [{ expr: `rate(http_requests_total{job="boulder-wfe"}[5m])`, refId: "A" }],
			fieldConfig: { defaults: { color: { mode: "palette-classic" } } },
			gridPos: { h: 8, w: 12, x: (i % 2) * 12, y: Math.floor(i / 2) * 8 },
		})),
		templating: { list: Array.from({ length: 5 }, (_, i) => ({ name: `var${i}`, query: "label_values(job)" })) },
		time: { from: "now-6h", to: "now" },
		annotations: { list: [{ datasource: "prometheus", enable: true }] },
	});
}

function gmailThread(): string {
	return JSON.stringify({
		id: "msg-18f3a2b4c5d6e7f8",
		threadId: "thread-18f3a2b4c5d6e7f8",
		from: "alice@example.com",
		to: "sheurich@example.com",
		cc: "security-team@example.com",
		subject: "Re: Access Review Q2 2026 — Action Required",
		date: "2026-04-14T16:30:00Z",
		snippet: "Please review the attached spreadsheet and confirm access levels for all team members by EOD Friday.",
		labelIds: ["INBOX", "IMPORTANT", "Label_42"],
		payload: {
			mimeType: "multipart/mixed",
			headers: Array.from({ length: 30 }, (_, i) => ({ name: `X-Header-${i}`, value: `value-${i}` })),
			parts: [
				{
					mimeType: "text/html",
					body: { data: Buffer.from("<html><body>" + "<p>Email body paragraph. </p>".repeat(50) + "</body></html>").toString("base64") },
				},
				{
					mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					filename: "access-review-q2-2026.xlsx",
					body: { attachmentId: "ATT001", size: 245000 },
				},
			],
		},
		internalDate: "1713115800000",
		sizeEstimate: 312000,
	});
}

function calendarEvents(): string {
	return JSON.stringify(
		Array.from({ length: 12 }, (_, i) => ({
			id: `evt-${1000 + i}`,
			summary: ["Weekly standup", "1:1 with manager", "CA review", "Sprint planning", "Retro", "Lunch", "Focus time", "Incident review", "Deploy window", "Team sync", "Office hours", "All hands"][i],
			start: { dateTime: `2026-04-15T${8 + i}:00:00-07:00` },
			end: { dateTime: `2026-04-15T${8 + i}:30:00-07:00` },
			status: "confirmed",
			attendees: Array.from({ length: 3 + i }, (_, j) => ({
				email: `user${j}@example.com`,
				responseStatus: j === 0 ? "accepted" : "needsAction",
				displayName: `User ${j}`,
			})),
			location: i % 3 === 0 ? "Room 42" : undefined,
			conferenceData: { entryPoints: [{ uri: `https://meet.google.com/abc-${i}`, entryPointType: "video" }] },
			reminders: { useDefault: true },
			organizer: { email: "organizer@example.com" },
			creator: { email: "organizer@example.com" },
			htmlLink: `https://calendar.google.com/event?eid=${1000 + i}`,
		})),
	);
}

// ── Build messages ──────────────────────────────────────────────────

const messages: AgentMessage[] = [
	// Atlassian
	{ role: "toolResult", toolName: "getJiraIssue", content: [{ type: "text", text: jiraIssue("CA-4567", "Rotate HSM keys for WAS18 partitions") }] },
	{ role: "toolResult", toolName: "searchJiraIssuesUsingJql", content: [{ type: "text", text: `[${jiraIssue("CA-4560", "Weekly patching — container images")}, ${jiraIssue("CA-4561", "CRL publication monitoring alert")}, ${jiraIssue("CA-4562", "Boulder upgrade to v2.8.1")}]` }] },
	{ role: "toolResult", toolName: "getConfluencePage", content: [{ type: "text", text: confluencePage() }] },

	// PagerDuty
	{ role: "toolResult", toolName: "get_incident", content: [{ type: "text", text: pagerdutyIncident() }] },
	{ role: "toolResult", toolName: "list_oncalls", content: [{ type: "text", text: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ user: { summary: `User ${i}` }, schedule: { summary: `Schedule ${i}` }, escalation_level: i % 3 + 1, start: "2026-04-15T00:00:00Z", end: "2026-04-22T00:00:00Z" }))) }] },

	// Grafana
	{ role: "toolResult", toolName: "query_loki_logs", content: [{ type: "text", text: lokiQueryResult() }] },
	{ role: "toolResult", toolName: "get_dashboard_by_uid", content: [{ type: "text", text: grafanaDashboard() }] },

	// Google Workspace
	{ role: "toolResult", toolName: "gmail_get", content: [{ type: "text", text: gmailThread() }] },
	{ role: "toolResult", toolName: "calendar_listEvents", content: [{ type: "text", text: calendarEvents() }] },

	// Non-MCP (should pass through)
	{ role: "user", content: [{ type: "text", text: "Check the incident and see if it's related to the Jira issue" }] },
	{ role: "toolResult", toolName: "read", content: [{ type: "text", text: "package.json contents here..." }] },
	{ role: "toolResult", toolName: "bash", content: [{ type: "text", text: "$ kubectl get pods\nNAME                    READY   STATUS\nboulder-wfe-abc123      1/1     Running\nboulder-wfe-def456      1/1     Running" }] },
];

// ── Run demo ────────────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║         MCP Compaction — Compression Demo                   ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

console.log("MCP usage statistics:");
console.log(gatherMcpStats(messages, toolMap));
console.log();

let totalOriginal = 0;
let totalCompressed = 0;
let mcpCount = 0;
let skippedCount = 0;

for (const msg of messages) {
	const originalSize = JSON.stringify(msg.content).length;
	const compressed = compressMcpResult(msg, toolMap);

	if (compressed) {
		mcpCount++;
		totalOriginal += originalSize;
		totalCompressed += compressed.length;

		const ratio = originalSize / compressed.length;
		const bar = "█".repeat(Math.min(40, Math.round(ratio * 2)));
		console.log(`  ${msg.toolName}`);
		console.log(`    ${originalSize.toLocaleString()} → ${compressed.length.toLocaleString()} chars  (${ratio.toFixed(1)}x) ${bar}`);
		console.log(`    ${compressed.slice(0, 120)}${compressed.length > 120 ? "..." : ""}`);
		console.log();
	} else {
		skippedCount++;
	}
}

console.log("─".repeat(64));
console.log(`  MCP results compressed: ${mcpCount}`);
console.log(`  Non-MCP messages (pass-through): ${skippedCount}`);
console.log(`  Total original:   ${totalOriginal.toLocaleString()} chars`);
console.log(`  Total compressed: ${totalCompressed.toLocaleString()} chars`);
console.log(`  Overall ratio:    ${(totalOriginal / totalCompressed).toFixed(1)}x compression`);
console.log(`  Bytes saved:      ${((totalOriginal - totalCompressed) / 1024).toFixed(0)}KB`);
console.log();
console.log("In a live session, this compression runs before the summarization LLM sees");
console.log("the messages — so the LLM works with signal, not boilerplate.");
