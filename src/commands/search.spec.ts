import assert from "node:assert/strict";
import { test } from "node:test";

import { UsageError } from "../argv.js";
import { createReporter } from "../reporter.js";
import {
  looksLikeAbiMismatch,
  looksLikeMissingNativeBinding,
  nativeModuleAdvice,
  searchCommand,
} from "./search.js";

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

test("classifies a Node ABI mismatch", () => {
  const result = {
    stderr:
      "The module was compiled against a different Node.js version using NODE_MODULE_VERSION 127",
  };
  assert.equal(looksLikeAbiMismatch(result), true);
  assert.equal(looksLikeMissingNativeBinding(result), false);
  assert.match(nativeModuleAdvice(result) ?? "", /pnpm install --force/);
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
    /allow better-sqlite3 and node-llama-cpp builds in pnpm-workspace.yaml/,
  );
});

test("leaves ordinary QMD errors unclassified", () => {
  const result = { stderr: "Unknown collection: missing" };
  assert.equal(looksLikeAbiMismatch(result), false);
  assert.equal(looksLikeMissingNativeBinding(result), false);
  assert.equal(nativeModuleAdvice(result), undefined);
});
