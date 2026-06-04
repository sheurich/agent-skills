import assert from "node:assert/strict";
import { test } from "node:test";

async function loadSelectionModule() {
  try {
    return await import("../extensions/auto-summarize/model-selection.ts");
  } catch (error) {
    assert.fail(`model selection helper missing: ${error.message}`);
  }
}

const model = (provider, id) => ({ provider, id });
const allAuthed = () => true;

test("selects the configured auto-summarize model before hardcoded candidates", async () => {
  const { selectBudgetModel } = await loadSelectionModule();
  const models = [
    model("amazon-bedrock", "us.anthropic.claude-haiku-4-5"),
    model("openai-codex", "gpt-5.4-mini"),
  ];

  const selected = selectBudgetModel(models, allAuthed, {
    autoSummarize: { model: "openai-codex/gpt-5.4-mini" },
  });

  assert.deepEqual(selected, model("openai-codex", "gpt-5.4-mini"));
});

test("matches versioned provider model IDs from a configured tier alias", async () => {
  const { selectBudgetModel } = await loadSelectionModule();
  const models = [
    model("amazon-bedrock", "global.anthropic.claude-haiku-4-5-20251001-v1:0"),
    model("amazon-bedrock", "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
  ];

  const selected = selectBudgetModel(models, allAuthed, {
    autoSummarize: { model: "amazon-bedrock/us.anthropic.claude-haiku-4-5" },
  });

  assert.deepEqual(selected, model("amazon-bedrock", "us.anthropic.claude-haiku-4-5-20251001-v1:0"));
});

test("uses the scout subagent model as the existing budget-tier fallback", async () => {
  const { selectBudgetModel } = await loadSelectionModule();
  const models = [
    model("amazon-bedrock", "us.anthropic.claude-haiku-4-5"),
    model("openai-codex", "gpt-5.4-mini"),
  ];

  const selected = selectBudgetModel(models, allAuthed, {
    subagents: {
      agentOverrides: {
        scout: { model: "openai-codex/gpt-5.4-mini" },
      },
    },
  });

  assert.deepEqual(selected, model("openai-codex", "gpt-5.4-mini"));
});

test("does not let legacy autoSummary.model override the scout budget-tier setting", async () => {
  const { selectBudgetModel } = await loadSelectionModule();
  const models = [
    model("amazon-bedrock", "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
    model("openai-codex", "gpt-5.4-mini"),
  ];

  const selected = selectBudgetModel(models, allAuthed, {
    autoSummary: { model: "amazon-bedrock/us.anthropic.claude-haiku-4-5" },
    subagents: {
      agentOverrides: {
        scout: { model: "openai-codex/gpt-5.4-mini" },
      },
    },
  });

  assert.deepEqual(selected, model("openai-codex", "gpt-5.4-mini"));
});

test("falls back to known budget candidate IDs when settings do not specify a model", async () => {
  const { selectBudgetModel } = await loadSelectionModule();
  const models = [
    model("openai-codex", "gpt-5.5"),
    model("openai-codex", "gpt-5.4-mini"),
  ];

  const selected = selectBudgetModel(models, allAuthed, {});

  assert.deepEqual(selected, model("openai-codex", "gpt-5.4-mini"));
});
