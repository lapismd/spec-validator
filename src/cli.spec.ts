import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const binary = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function run(args: string[], cwd = path.dirname(path.dirname(binary))) {
  return spawnSync(process.execPath, [binary, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("CLI runs when the bin entry is reached through a package symlink", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-bin-"));
  try {
    const linkedBinary = path.join(root, "spec-validator");
    symlinkSync(binary, linkedBinary);
    const result = spawnSync(
      process.execPath,
      [linkedBinary, "--help", "--json"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      ok: boolean;
      exitCode: number;
    };
    assert.deepEqual(
      { ok: report.ok, exitCode: report.exitCode },
      { ok: true, exitCode: 0 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI rejects unknown flags and validators with one JSON envelope", () => {
  for (const args of [
    ["validate", "--bogus", "--json"],
    ["validate", "--only", "missing", "--json"],
    ["first", "--head", "HEAD", "--json"],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout) as {
      exitCode: number;
      ok: boolean;
    };
    assert.equal(report.exitCode, 2);
    assert.equal(report.ok, false);
  }
});

test("check JSON is one document with ordered lane results", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-cli-"));
  try {
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    writeFileSync(
      path.join(root, "spec-validator.config.json"),
      `${JSON.stringify({
        name: "fixture",
        ruleIds: { internal: "FIX-GOV-001" },
        validators: {},
        check: { lanes: [], build: false, first: false },
      })}\n`,
    );
    const init = spawnSync("git", ["init", "--quiet"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(init.status, 0);
    const result = run(["check", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      ok: boolean;
      lanes: Array<{ name: string }>;
    };
    assert.equal(report.ok, true);
    assert.deepEqual(
      report.lanes.map((lane) => lane.name),
      ["validate"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
