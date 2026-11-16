import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
function doctor(verification: unknown, files: string[], strict = false) {
  const root = mkdtempSync(join(tmpdir(), "spec-doctor-files-"));
  try {
    for (const file of [".gitignore", ...files]) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(
        target,
        file === ".gitignore" ? "spec/book/\n" : "# Fixture\n",
      );
    }
    writeFileSync(
      join(root, "spec-validator.config.json"),
      JSON.stringify({
        name: "fixture",
        ruleIds: { internal: "TEST-GOV-001" },
        diagnostics: { "*": "TEST-GOV-001" },
        validators: { verification },
      }),
    );
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        scripts: { "spec:check": "node source-owned-wrapper.mjs" },
      }),
    );
    const result = spawnSync(
      process.execPath,
      [cli, "doctor", "--json", ...(strict ? ["--strict"] : [])],
      { cwd: root, encoding: "utf8" },
    );
    assert.ifError(result.error);
    assert(result.stdout, result.stderr);
    return { status: result.status, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const summary = "spec/src/SUMMARY.md";
const matrix = "spec/src/current/verification.md";

test("public doctor accepts a configured literal verification path and preserves alias warnings", () => {
  const { status, report } = doctor({ file: "current/verification.md" }, [
    summary,
    matrix,
  ]);
  assert.equal(status, 0);
  assert.equal(
    report.checks.find((check: { name: string }) => check.name === matrix)
      ?.status,
    "pass",
  );
  assert.equal(
    report.checks.find((check: { name: string }) => check.name === "scripts")
      ?.status,
    "warn",
  );
  assert.equal(
    doctor({ file: "current/verification.md" }, [summary, matrix], true).status,
    1,
  );
});

test("public doctor accepts pattern-selected matrices without inventing a default matrix", () => {
  const { status, report } = doctor(
    { files: ["^current/verification\\.md$", "^other/verification\\.md$"] },
    [summary, matrix, "spec/src/other/verification.md"],
  );
  assert.equal(status, 0);
  assert.equal(
    report.checks.filter((check: { name: string }) =>
      check.name.endsWith("/verification.md"),
    ).length,
    2,
  );
});

test("empty configured patterns fail even when the default and ignored literal file exist", () => {
  const { status, report } = doctor(
    { file: "legacy.md", files: ["^missing/verification\\.md$"] },
    [summary, "spec/src/verification.md", "spec/src/legacy.md"],
  );
  assert.equal(status, 1);
  assert(
    report.checks.some(
      (check: { status: string; message: string }) =>
        check.status === "fail" &&
        /verification selection is empty/.test(check.message),
    ),
  );
});

test("missing literal and default matrices remain failures", () => {
  assert.equal(
    doctor({ file: "current/verification.md" }, [
      summary,
      "spec/src/verification.md",
    ]).status,
    1,
  );
  assert.equal(doctor(true, [summary]).status, 1);
  assert.equal(doctor(true, [summary, "spec/src/verification.md"]).status, 0);
});

test("missing summary is never hidden by a matching matrix", () => {
  assert.equal(
    doctor({ files: ["^current/verification\\.md$"] }, [matrix]).status,
    1,
  );
});

test("disabled verification does not demand an inactive matrix", () => {
  assert.equal(doctor(false, [summary]).status, 0);
});
