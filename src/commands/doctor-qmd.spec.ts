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

import { qmdBinaryCheck, qmdNativeCheck } from "./doctor-qmd.js";

function shim(root: string, script: string): string {
  const target = join(root, "qmd");
  writeFileSync(target, `#!/bin/sh\n${script}\n`);
  chmodSync(target, 0o755);
  return target;
}

test("qmd-binary warns with the npm install command when qmd is missing", () => {
  const check = qmdBinaryCheck(null);
  assert.equal(check.name, "qmd-binary");
  assert.equal(check.status, "warn");
  assert.match(check.message, /npm install -g --allow-scripts=better-sqlite3/);
  assert.match(check.message, /fall back to rg/);
});

test("qmd-binary passes when a system binary is resolved", () => {
  const check = qmdBinaryCheck("/usr/local/bin/qmd");
  assert.equal(check.status, "pass");
  assert.match(check.message, /\/usr\/local\/bin\/qmd/);
});

test("qmd-native fails an ABI mismatch with the exact repair command", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-doctor-qmd-"));
  try {
    const binary = shim(
      root,
      "echo 'compiled against a different Node.js version using NODE_MODULE_VERSION 147' >&2\nexit 1",
    );
    const check = qmdNativeCheck(root, binary);
    assert.equal(check.name, "qmd-native");
    assert.equal(check.status, "fail");
    assert.match(check.message, /Node ABI \d+|Node runtime/);
    assert.match(check.message, /npm rebuild -g better-sqlite3/);
    assert.match(
      check.message,
      /npm install -g --allow-scripts=better-sqlite3,node-llama-cpp @tobilu\/qmd/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("qmd-native fails a missing binding with the reinstall command", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-doctor-qmd-"));
  try {
    const binary = shim(
      root,
      "echo 'Error: Could not locate the bindings file better_sqlite3.node' >&2\nexit 1",
    );
    const check = qmdNativeCheck(root, binary);
    assert.equal(check.status, "fail");
    assert.match(check.message, /npm install -g/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("qmd-native passes a healthy status probe", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-doctor-qmd-"));
  try {
    const binary = shim(root, "echo 'QMD Status'\nexit 0");
    const check = qmdNativeCheck(root, binary);
    assert.equal(check.status, "pass");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("qmd-native warns with the first error line for other failures", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-doctor-qmd-"));
  try {
    const binary = shim(
      root,
      "echo 'Collection not found: fixture' >&2\nexit 1",
    );
    const check = qmdNativeCheck(root, binary);
    assert.equal(check.status, "warn");
    assert.match(check.message, /Collection not found: fixture/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("qmd-native skips the probe when no binary is on PATH", () => {
  const check = qmdNativeCheck("/missing-root", null);
  assert.equal(check.status, "warn");
  assert.match(check.message, /not on PATH/);
});
