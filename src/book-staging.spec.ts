import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveConfig } from "./config.js";
import { stageBook } from "./book-staging.js";
test("nested book builds complete navigation without rewriting authored sources", () => {
  const root = mkdtempSync(join(tmpdir(), "nested-book-"));
  try {
    mkdirSync(join(root, "spec/src/topic"), { recursive: true });
    const source =
      "# Summary\n\n- [Home](index.md)\n{{#include topic/SUMMARY.nav.md}}\n";
    writeFileSync(join(root, "spec/src/SUMMARY.md"), source);
    writeFileSync(join(root, "spec/src/index.md"), "# Home\n");
    writeFileSync(
      join(root, "spec/src/topic/SUMMARY.nav.md"),
      "- [Nested topic](index.md)\n",
    );
    writeFileSync(
      join(root, "spec/src/topic/index.md"),
      "# Nested topic\n\nExact nested content.\n",
    );
    writeFileSync(
      join(root, "spec/book.toml"),
      '[book]\ntitle = "Fixture"\nsrc = "src"\n[build]\nbuild-dir = "book"\ncreate-missing = false\n',
    );
    const config = resolveConfig({
      ruleIds: { internal: "SV-VAL-004", summary: "SV-VAL-004" },
      validators: { summary: { fragments: true } },
    });
    const stage = stageBook(root, config);
    execFileSync("mdbook", ["build", stage], { stdio: "pipe" });
    assert.match(
      readFileSync(join(root, "spec/book/topic/index.html"), "utf8"),
      /Exact nested content/,
    );
    assert.equal(
      readFileSync(join(root, "spec/src/SUMMARY.md"), "utf8"),
      source,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
