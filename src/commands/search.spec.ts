import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UsageError } from "../argv.js";
import type { WritableStreamLike } from "../platform/types.js";
import { createReporter, type Reporter } from "../reporter.js";
import {
  looksLikeAbiMismatch,
  looksLikeMissingNativeBinding,
  looksLikeModelUnavailable,
  nativeModuleAdvice,
  searchCommand,
} from "./search.js";

const ABI_STDERR =
  "The module was compiled against a different Node.js version using NODE_MODULE_VERSION 147";

function stubStream(lines: string[]): WritableStreamLike {
  return {
    isTTY: false,
    write(value: string) {
      lines.push(value);
      return true;
    },
  };
}

function captureReporter(json: boolean): {
  reporter: Reporter;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    reporter: createReporter(
      { color: "never", json },
      stubStream(stdout),
      stubStream(stderr),
    ),
    stdout,
    stderr,
  };
}

function shim(directory: string, name: string, script: string): string {
  mkdirSync(directory, { recursive: true });
  const target = join(directory, name);
  writeFileSync(target, `#!/bin/sh\n${script}\n`);
  chmodSync(target, 0o755);
  return target;
}

function qmdFixture(options: { qmd?: string; rg?: string }): {
  root: string;
  binDir: string;
} {
  const root = mkdtempSync(join(tmpdir(), "spec-search-host-"));
  const binDir = join(root, "bin");
  mkdirSync(join(root, ".qmd"), { recursive: true });
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    join(root, "spec-validator.config.json"),
    `${JSON.stringify({
      name: "fixture",
      ruleIds: { qmd: "SV-QMD-001", internal: "SV-QMD-002" },
      validators: { qmd: { collection: "fixture-spec" } },
    })}\n`,
  );
  writeFileSync(join(root, ".qmd/index.yml"), "collections: {}\n");
  if (options.qmd !== undefined) shim(binDir, "qmd", options.qmd);
  if (options.rg !== undefined) shim(binDir, "rg", options.rg);
  return { root, binDir };
}

function withPath<T>(binDir: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.PATH;
  process.env.PATH = previous ? `${binDir}:${previous}` : binDir;
  return run().finally(() => {
    process.env.PATH = previous;
  });
}

test("index rejects search-only arguments before loading configuration", async () => {
  await assert.rejects(
    () =>
      searchCommand(
        "/missing",
        ["--limit", "2"],
        createReporter({ color: "never", json: false }),
        "index",
      ),
    UsageError,
  );
});

test("classifies a Node ABI mismatch with npm repair commands", () => {
  const result = { stderr: ABI_STDERR };
  assert.equal(looksLikeAbiMismatch(result), true);
  assert.equal(looksLikeMissingNativeBinding(result), false);
  const advice = nativeModuleAdvice(result) ?? "";
  assert.match(advice, /npm rebuild -g better-sqlite3/);
  assert.match(advice, /npm install -g --allow-scripts=better-sqlite3/);
  assert.doesNotMatch(advice, /deno/i);
});

test("classifies a missing better-sqlite3 binding", () => {
  const result = {
    stderr:
      "Error: Could not locate the bindings file. Tried:\n → /tmp/better_sqlite3.node",
  };
  assert.equal(looksLikeMissingNativeBinding(result), true);
  assert.equal(looksLikeAbiMismatch(result), false);
  assert.match(
    nativeModuleAdvice(result) ?? "",
    /npm install -g --allow-scripts=better-sqlite3,node-llama-cpp @tobilu\/qmd/,
  );
});

test("classifies an unavailable embedding model", () => {
  const result = { stderr: "could not download embedding model gguf" };
  assert.equal(looksLikeModelUnavailable(result), true);
  assert.equal(looksLikeAbiMismatch(result), false);
  assert.match(nativeModuleAdvice(result) ?? "", /omit --semantic/);
});

test("leaves ordinary QMD errors unclassified", () => {
  const result = { stderr: "Unknown collection: missing" };
  assert.equal(looksLikeAbiMismatch(result), false);
  assert.equal(looksLikeMissingNativeBinding(result), false);
  assert.equal(looksLikeModelUnavailable(result), false);
  assert.equal(nativeModuleAdvice(result), undefined);
});

test("search degrades to an executed rg fallback with exit status 0", async () => {
  const { root, binDir } = qmdFixture({
    qmd: `printf '%s\\n' '${ABI_STDERR}' >&2\nexit 1`,
    rg: "printf 'spec/src/web.md:12: LN-WEB-074 guarded leave\\n'",
  });
  try {
    const { reporter, stdout, stderr } = captureReporter(false);
    const code = await withPath(binDir, () =>
      searchCommand(root, ["LN-WEB-074"], reporter, "search"),
    );
    assert.equal(code, 0);
    assert.match(stdout.join(""), /spec\/src\/web\.md:12: LN-WEB-074/);
    const warning = stderr.join("");
    assert.match(warning, /degraded to the rg fallback/);
    assert.match(warning, /npm rebuild -g better-sqlite3/);
    assert.match(warning, /spec-validator doctor/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("search prints the fallback command when rg is unavailable", async () => {
  const { root, binDir } = qmdFixture({
    qmd: "echo 'NODE_MODULE_VERSION 147' >&2\nexit 1",
  });
  try {
    const { reporter, stdout } = captureReporter(false);
    const previous = process.env.PATH;
    process.env.PATH = binDir;
    let code: number;
    try {
      code = await searchCommand(root, ["LN-WEB-074"], reporter, "search");
    } finally {
      process.env.PATH = previous;
    }
    assert.equal(code, 0);
    assert.match(
      stdout.join(""),
      /Fallback: rg -n -i --glob '\*\.md' 'LN-WEB-074' 'spec\/src'/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("search degradation keeps one versioned JSON envelope", async () => {
  const { root, binDir } = qmdFixture({
    qmd: "echo 'NODE_MODULE_VERSION 147' >&2\nexit 1",
    rg: "printf 'spec/src/web.md:12: hit\\n'",
  });
  try {
    const { reporter, stdout } = captureReporter(true);
    const code = await withPath(binDir, () =>
      searchCommand(root, ["LN-WEB-074"], reporter, "search"),
    );
    assert.equal(code, 0);
    const report = JSON.parse(stdout.join("")) as {
      ok: boolean;
      exitCode: number;
      degraded?: boolean;
      warning?: string;
      results?: string[];
    };
    assert.equal(report.ok, true);
    assert.equal(report.exitCode, 0);
    assert.equal(report.degraded, true);
    assert.match(report.warning ?? "", /npm rebuild -g better-sqlite3/);
    assert.deepEqual(report.results, ["spec/src/web.md:12: hit"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("search degrades when the system qmd binary is missing", async () => {
  const { root, binDir } = qmdFixture({
    rg: "printf 'spec/src/web.md:3: hit\\n'",
  });
  try {
    const { reporter, stderr } = captureReporter(false);
    const previous = process.env.PATH;
    process.env.PATH = binDir;
    let code: number;
    try {
      code = await searchCommand(root, ["anything"], reporter, "search");
    } finally {
      process.env.PATH = previous;
    }
    assert.equal(code, 0);
    assert.match(stderr.join(""), /npm install -g --allow-scripts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("index keeps a non-zero exit for the same environmental failure", async () => {
  const { root, binDir } = qmdFixture({
    qmd: `printf '%s\\n' '${ABI_STDERR}' >&2\nexit 1`,
    rg: "printf 'spec/src/web.md:12: hit\\n'",
  });
  try {
    const { reporter, stderr } = captureReporter(false);
    const code = await withPath(binDir, () =>
      searchCommand(root, [], reporter, "index"),
    );
    assert.equal(code, 1);
    const warning = stderr.join("");
    assert.match(warning, /Specification index refresh failed/);
    assert.match(warning, /npm rebuild -g better-sqlite3/);
    assert.match(warning, /Fallback: rg/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
