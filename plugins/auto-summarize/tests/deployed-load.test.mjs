import assert from "node:assert/strict";
import { mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

const testDir = dirname(fileURLToPath(import.meta.url));
const extensionSource = resolve(testDir, "..", "extensions", "auto-summarize");

test("Pi can load auto-summarize through a deployed directory symlink", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auto-summarize-load-"));
  const link = join(dir, "auto-summarize");
  await symlink(extensionSource, link, "dir");

  const result = spawnSync(
    "pi",
    [
      "--mode", "text",
      "-p",
      "--no-session",
      "--no-tools",
      "--no-skills",
      "--no-context-files",
      "--no-prompt-templates",
      "--no-themes",
      "--no-extensions",
      "-e", link,
      "Reply with exactly: ok",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Failed to load extension|Cannot find module/);
  assert.match(result.stdout.trim(), /ok/);
});
