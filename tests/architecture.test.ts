import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { countedLines, physicalLines } from "../scripts/architecture-lines.js";
import {
  fileKind,
  isDumpPath,
  isTestSpecifier,
} from "../scripts/architecture-policy.js";
import { checkArchitecture, parseArgs } from "../scripts/check-architecture.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url)).replace(
  /\/$/u,
  "",
);
const fixturesRoot = `${repositoryRoot}/scripts/architecture-fixtures`;

function run(
  fixture: string,
  args: string[] = [],
): { ok: boolean; rules: string[]; messages: string[] } {
  const report = checkArchitecture({
    root: `${fixturesRoot}/${fixture}`,
    quiet: true,
    ...parseArgs(args),
  });
  return {
    ok: report.ok,
    rules: report.errors.map((error) => error.rule),
    messages: report.errors.map((error) => error.message),
  };
}

function spawnChecker(args: string[], env: Record<string, string> = {}) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "./scripts/check-architecture.ts", ...args],
    {
      cwd: repositoryRoot,
      env: { ...process.env, ...env },
      encoding: "utf8",
    },
  );
}

test("counted-line metric ignores blank and comment-only lines", () => {
  const source = [
    "export const n = 1;",
    "",
    "// comment",
    "/* block */",
    "/**",
    " * docs",
    " */",
    "export const m = 2;",
    "<!-- html -->",
    "",
  ].join("\n");
  assertEqual(countedLines(source), 2, "counted lines");
  assertEqual(physicalLines(source), 9, "physical lines");
  assertEqual(countedLines(""), 0, "empty counted lines");
  assertEqual(physicalLines(""), 0, "empty physical lines");
  assertEqual(
    countedLines("export const mixed = 1; // trailing\n"),
    1,
    "mixed comment plus code counts as code",
  );
});

test("file kinds classify tests, scripts, and production", () => {
  assertEqual(fileKind("src/model.ts"), "production", "src module");
  assertEqual(fileKind("src/model.spec.ts"), "test", "spec module");
  assertEqual(
    fileKind("packages/workspace-tools/src/w.test.ts"),
    "test",
    "workspace test",
  );
  assertEqual(fileKind("scripts/check-architecture.ts"), "script", "script");
  assertEqual(
    fileKind("tests/architecture.test.ts"),
    "test",
    "tests directory",
  );
});

test("dump filenames and test specifiers are rejected", () => {
  for (const name of ["utils", "helpers", "common", "services"]) {
    assert(isDumpPath(`src/${name}.ts`), `src/${name}.ts must be rejected`);
    assert(isDumpPath(`src/${name}/model.ts`), `src/${name}/ must be rejected`);
  }
  assert(
    !isDumpPath("src/validators/governance.ts"),
    "named module must be allowed",
  );
  assert(isTestSpecifier("./model.spec.ts"), "spec specifier");
  assert(isTestSpecifier("./model.test"), "bare test specifier");
  assert(!isTestSpecifier("./model.ts"), "production specifier");
});

test("a new production file over 300 counted lines fails", () => {
  const result = run("new-oversize");
  assert(!result.ok, "oversize new file must fail");
  assert(result.rules.includes("new-file-budget"), result.rules.join(","));
  assert(
    result.messages.some((message) => message.includes("301/300")),
    result.messages.join("; "),
  );
});

test("counted-line growth of a baselined file fails", () => {
  const result = run("growth");
  assert(!result.ok, "growth must fail");
  assert(result.rules.includes("counted-line-growth"), result.rules.join(","));
});

test("a valid extraction with updated budgets passes", () => {
  const result = run("extraction");
  assert(result.ok, result.messages.join("; "));
  assert(!result.rules.includes("new-file-budget"), "must not report budget");
  assert(!result.rules.includes("counted-line-growth"), "must not grow");
});

test("production imports of tests fail", () => {
  const result = run("production-test-import");
  assert(!result.ok, "production test import must fail");
  assert(
    result.rules.includes("production-test-import"),
    result.rules.join(","),
  );
});

test("a generic dump filename fails", () => {
  const result = run("dump-filename");
  assert(!result.ok, "dump filename must fail");
  assert(result.rules.includes("dump-filename"), result.rules.join(","));
});

test("a renamed path missing from disk fails", () => {
  const result = run("rename-missing");
  assert(!result.ok, "renamed baseline path must fail");
  assert(
    result.rules.includes("missing-baseline-path"),
    result.rules.join(","),
  );
});

test("a missing baseline file fails closed", () => {
  const result = run("missing-baseline");
  assert(!result.ok, "missing baseline must fail");
  assert(
    result.rules.includes("architecture-baseline-missing"),
    result.rules.join(","),
  );
});

test("a root without source files fails closed", () => {
  const result = run("empty-root");
  assert(!result.ok, "empty root must fail");
  assert(result.rules.includes("no-inputs"), result.rules.join(","));
});

test("a comment-only edit does not change counted lines", () => {
  const result = run("comment-only");
  assert(result.ok, result.messages.join("; "));
  assert(!result.rules.includes("counted-line-growth"), "comments are free");
});

test("a stale budget above the current size plus slack fails", () => {
  const result = run("stale-budget");
  assert(!result.ok, "stale budget must fail");
  assert(result.rules.includes("stale-budget"), result.rules.join(","));
});

test("--write-baseline is refused when CI is true", () => {
  const result = checkArchitecture({
    root: `${fixturesRoot}/empty-root`,
    writeBaseline: true,
    ci: true,
    quiet: true,
  });
  assert(!result.ok, "CI baseline write must fail");
  assert(
    result.errors.some((error) => error.rule === "write-baseline-forbidden"),
    result.errors.map((error) => error.rule).join(","),
  );
});

test("argument parsing exposes root, baseline, and write flags", () => {
  const options = parseArgs([
    "--root",
    "/tmp/example",
    "--baseline",
    "/tmp/example/scripts/architecture-baseline.json",
    "--write-baseline",
    "--quiet",
  ]);
  assertEqual(options.root, "/tmp/example", "root");
  assertEqual(
    options.baselinePath,
    "/tmp/example/scripts/architecture-baseline.json",
    "baseline path",
  );
  assertEqual(options.writeBaseline, true, "write flag");
  assertEqual(options.quiet, true, "quiet flag");
  assertEqual(parseArgs([]).writeBaseline, false, "default write flag");
});

test("the CLI exits non-zero for a failing tree", () => {
  // No --quiet here: the test asserts on the reported rule text.
  const result = spawnChecker(["--root", `${fixturesRoot}/new-oversize`]);
  assertEqual(result.status, 1, "failing tree exit code");
  assert(
    (result.stderr ?? "").includes("new-file-budget"),
    result.stderr ?? "",
  );
});

test("the CLI refuses to write a baseline when CI=true", () => {
  const result = spawnChecker(
    ["--root", `${fixturesRoot}/empty-root`, "--write-baseline"],
    { CI: "true" },
  );
  assertEqual(result.status, 1, "CI write exit code");
  assert(
    (result.stderr ?? "").includes("write-baseline-forbidden"),
    result.stderr ?? "",
  );
});

test("the repository architecture baseline passes", () => {
  const result = spawnChecker([]);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assertEqual(result.status, 0, `pnpm check:architecture failed: ${output}`);
});

test("the committed baseline covers every audited source root", () => {
  const baseline = JSON.parse(
    readFileSync(
      `${repositoryRoot}/scripts/architecture-baseline.json`,
      "utf8",
    ),
  ) as { limits: Record<string, number>; files: Record<string, unknown> };
  assertEqual(baseline.limits.newProductionCountedLines, 300, "prod limit");
  assertEqual(baseline.limits.newTestCountedLines, 500, "test limit");
  assertEqual(baseline.limits.newScriptCountedLines, 300, "script limit");
  const paths = Object.keys(baseline.files);
  const roots = ["src/", "scripts/", "tests/", "packages/workspace-tools/src/"];
  for (const root of roots) {
    assert(
      paths.some((path) => path.startsWith(root)),
      `covers ${root}`,
    );
  }
  assert(
    !paths.some((path) => path.includes("architecture-fixtures")),
    "fixtures are excluded from the baseline",
  );
});
