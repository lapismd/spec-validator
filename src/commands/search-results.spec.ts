import assert from "node:assert/strict";
import { test } from "node:test";
import { scopedSearchResults } from "./search-results.js";
test("scoped results resolve filesystem and collection paths to absolute sources", () => {
  assert.deepEqual(
    scopedSearchResults("/repo", "spec/src/current", "current", [
      { file: "./spec/src/current/topic.md", line: 17, score: 0.8 },
      { file: "qmd://current/nested/topic.md", line: 3 },
    ]),
    [
      { file: "/repo/spec/src/current/topic.md", line: 17, score: 0.8 },
      { file: "/repo/spec/src/current/nested/topic.md", line: 3 },
    ],
  );
  assert.throws(
    () =>
      scopedSearchResults("/repo", "spec/src/current", "current", [
        { file: "./spec/src/history/old.md" },
      ]),
    /outside/,
  );
});
