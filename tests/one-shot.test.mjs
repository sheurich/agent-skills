import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = resolve(root, "skills/one-shot");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("one-shot has portable frontmatter and stays within the skill size limit", () => {
  const skill = read("skills/one-shot/SKILL.md");
  assert.match(skill, /^---\nname: one-shot\ndescription:/);
  assert.ok(skill.split("\n").length <= 500, "skill exceeds 500 lines");
  assert.doesNotMatch(skill, /^allowed-tools:|^context: fork|^agent:/m);
  assert.doesNotMatch(skill, /!`|\$\{CLAUDE_|skill:\/\//);
});

test("the recovery record ships with the skill and all local links resolve", () => {
  const skill = read("skills/one-shot/SKILL.md");
  assert.match(skill, /\]\(\.\/assets\/job\.md\)/);
  for (const match of skill.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|#)/.test(target)) continue;
    const path = resolve(skillDir, target.split("#")[0]);
    assert.ok(!relative(skillDir, path).startsWith(".."),
      `standalone skill link escapes its installed directory: ${target}`);
    assert.ok(statSync(path).isFile(), `missing linked file: ${target}`);
  }
  const record = read("skills/one-shot/assets/job.md");
  for (const heading of ["Brief", "Tasks", "Evidence", "Recovery", "Delivery"]) {
    assert.match(record, new RegExp(`^## ${heading}$`, "m"));
  }
});

test("the workflow records a specification before implementation", () => {
  assert.ok(/^## Specification$/m.test(read("skills/one-shot/assets/job.md")),
    "job record is missing its Specification section");
  assert.ok(/specification/i.test(read("skills/one-shot/SKILL.md")),
    "workflow is missing its specification step");
});

test("the Pi prompt loads the skill and accepts optional task arguments as text", () => {
  const prompt = read("prompts/one-shot.md");
  assert.match(prompt, /^---\ndescription:/);
  assert.match(prompt, /^argument-hint: "\[task\]"$/m);
  assert.match(prompt, /one-shot/);
  assert.match(prompt, /\$\{@:-[^}]*current conversation[^}]*\}/);
  assert.doesNotMatch(prompt, /!`/);
  assert.ok(prompt.split("\n").length <= 30, "entry prompt duplicates the skill");
});

test("marketplace and README expose the portable skill", () => {
  const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
  const entries = marketplace.plugins[0].skills.filter((x) => x === "./skills/one-shot");
  assert.equal(entries.length, 1, "marketplace must register the skill exactly once");
  assert.match(read("README.md"), /\]\(skills\/one-shot\/SKILL\.md\)/);
  assert.match(read("README.md"), /\]\(docs\/one-shot-pi\.md\)/);
});

test("Pi guidance remains outside the portable skill", () => {
  const guidance = read("docs/one-shot-pi.md");
  assert.match(guidance, /\/one-shot/);
  assert.doesNotMatch(read("skills/one-shot/SKILL.md"), /subagent\(\{|swival-subagent\(/);
  const manifest = JSON.parse(read("package.json"));
  assert.equal(manifest.pi, undefined, "preserve conventional root package discovery");
});

// The optional module path is trusted test-runner configuration, fixed at startup.
// No package is downloaded and no provider or model is called by this check.
const piPromptModule = process.env.PI_PROMPT_MODULE;
test("installed Pi loads the prompt and preserves five argument cases", {
  skip: !piPromptModule && "set PI_PROMPT_MODULE to the installed prompt-templates.js",
}, async () => {
  assert.ok(isAbsolute(piPromptModule), "PI_PROMPT_MODULE must be an absolute path");
  const { loadPromptTemplates, expandPromptTemplate } =
    await import(pathToFileURL(piPromptModule).href);
  const { templates, diagnostics } = loadPromptTemplates({
    cwd: root,
    agentDir: root,
    promptPaths: [resolve(root, "prompts/one-shot.md")],
    includeDefaults: false,
  });
  assert.deepEqual(diagnostics, []);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].name, "one-shot");
  assert.equal(templates[0].argumentHint, "[task]");
  const cases = [
    ["/one-shot", "Use the current conversation to identify the job."],
    ['/one-shot "Fix the CSV parser"', "Fix the CSV parser"],
    ['/one-shot "First line\nSecond line"', "First line\nSecond line"],
    ['/one-shot "$1; $(printf injected); `id`"', "$1; $(printf injected); `id`"],
    ["/one-shot Add a flag", "Add a flag"],
  ];
  for (const [input, expected] of cases) {
    const expanded = expandPromptTemplate(input, templates);
    assert.match(expanded, /Read the one-shot skill/);
    assert.equal(expanded.split("\nTask:\n").at(-1), expected,
      `incorrect task expansion: ${input}`);
  }
});
