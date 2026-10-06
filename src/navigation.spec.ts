import assert from "node:assert/strict";
import { test } from "node:test";
import { expandSummary } from "./navigation.js";
function files(values: Record<string, string>) {
  return Object.entries(values).map(([chapterPath, source]) => ({
    chapterPath,
    source,
    relativePath: chapterPath,
    absolutePath: chapterPath,
  }));
}
test("nested navigation rebases fragment links and retains indentation", () => {
  const result = expandSummary(
    files({
      "SUMMARY.md": "# Summary\n  {{#include current/SUMMARY.nav.md}}",
      "current/SUMMARY.nav.md":
        "- [Contract](contract.md)\n{{#include nested/SUMMARY.nav.md}}",
      "current/nested/SUMMARY.nav.md": "  - [Detail](detail.md)",
    }),
  );
  assert.match(result.source, /  - \[Contract\]\(current\/contract.md\)/);
  assert.match(result.source, /    - \[Detail\]\(current\/nested\/detail.md\)/);
  assert.equal(result.fragments.size, 2);
});
test("nested navigation rejects missing fragments, cycles and source escape", () => {
  assert.throws(
    () => expandSummary(files({ "SUMMARY.md": "{{#include absent.md}}" })),
    /missing/,
  );
  assert.throws(
    () =>
      expandSummary(
        files({
          "SUMMARY.md": "{{#include nested.md}}",
          "nested.md": "{{#include SUMMARY.md}}",
        }),
      ),
    /cycle/,
  );
  assert.throws(
    () => expandSummary(files({ "SUMMARY.md": "{{#include ../outside.md}}" })),
    /unsafe/,
  );
});
