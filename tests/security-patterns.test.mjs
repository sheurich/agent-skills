import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Structural instruction guards, not evidence that an agent obeys the prose.
// Read the submitted content as data; never execute its hooks or scripts.
const reference = readFileSync(new URL(
  "../skills/security-patterns/references/supply-chain-of-skills-plugins-and-mcp-servers.md",
  import.meta.url,
), "utf8");
const heading = "Read every line of every hook and script before accepting a skill";
const sections = reference.split(/^## /m)
  .filter((part) => part.startsWith(`${heading}\n`));
assert.equal(sections.length, 1, "expected exactly one hook/script review section");
const section = sections[0];
const rule = section.match(/^- Rule: (.+)$/m)?.[1];
assert.ok(rule, "hook/script review section must contain a Rule bullet");
const runtimeGate = () => {
  const sentence = rule.match(/Before any runtime tests,[^.]*\./)?.[0];
  assert.ok(sentence, "require an explicit gate before any runtime tests");
  return sentence;
};

test("hook/script review removes the original unsafe 'run them locally' directive", () => {
  assert.doesNotMatch(section, /\brun them locally\b/i);
});

test("hook/script review defaults to line-by-line static review", () => {
  assert.ok(rule.includes(
    "line-by-line static review of all shell and Python in hooks and scripts by default",
  ));
});

test("hook/script review prohibits submitted hooks and scripts on the host", () => {
  assert.match(rule, /never run submitted hooks or scripts on the host/i);
});

test("runtime tests require separate explicit operator approval before execution", () => {
  assert.ok(runtimeGate().startsWith(
    "Before any runtime tests, require separate explicit operator approval",
  ));
});

test("runtime tests require a disposable VM or container before execution", () => {
  assert.match(runtimeGate(), /require .+ and a disposable VM or container\b/);
});

test("runtime tests deny host mounts, credentials, and network before execution", () => {
  assert.match(runtimeGate(), /with no host mounts, no credentials, and no network\./);
});

test("hook/script review retains owner approval, version scrutiny, and rejection criteria", () => {
  assert.match(rule, /Require a code owner's approval/);
  assert.match(rule, /apply the same scrutiny to version bumps as to new submissions/i);
  assert.ok(rule.includes(
    "reject undocumented network requests, hooks that inject unrelated behaviour "
    + "into tool calls, obfuscated code (base64, `eval`, encoded strings), "
    + "and content with no real value",
  ));
});

test("hook/script review distinguishes stricter local requirements from the upstream source", () => {
  assert.match(section, /^- Sources: `skills-curated\/main\/CLAUDE\.md`$/m);
  const mechanism = section.match(/^- Mechanism: (.+)$/m)?.[1];
  assert.ok(mechanism?.endsWith(
    "This repository adds the stricter local static-review and runtime-isolation requirements.",
  ));
});
