import assert from "node:assert/strict";
import { test } from "node:test";

test("summary requests include provider instructions for Codex Responses", async () => {
  const { createSummaryContext } = await import("../extensions/auto-summarize/summary-request.ts");

  const context = createSummaryContext("Summarize this session.", 0);

  assert.equal(typeof context.systemPrompt, "string");
  assert.ok(context.systemPrompt.trim().length > 0);
  assert.deepEqual(context.messages, [
    {
      role: "user",
      content: [{ type: "text", text: "Summarize this session." }],
      timestamp: 0,
    },
  ]);
});
