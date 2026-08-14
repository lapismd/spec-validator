import assert from "node:assert/strict";
import { test } from "node:test";

import { classifySpecFirstChanges, parseUnifiedDiff } from "./spec-first.js";

test("spec-first requires mapped chapters for protected files", () => {
  const result = classifySpecFirstChanges(["src/cli.ts", "spec/src/cli.md"], {
    ignore: ["\\.spec\\.ts$"],
    rules: [{ pattern: "^src/cli\\.ts$", chapters: ["spec/src/cli.md"] }],
    protected: ["^src/"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.protectedFiles, ["src/cli.ts"]);
});

test("spec-first fails when the mapped chapter is absent", () => {
  const result = classifySpecFirstChanges(["src/cli.ts"], {
    ignore: [],
    rules: [{ pattern: "^src/cli\\.ts$", chapters: ["spec/src/cli.md"] }],
    protected: ["^src/"],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingChapters, ["spec/src/cli.md"]);
});

test("parseUnifiedDiff reads git headers", () => {
  const changes = parseUnifiedDiff(
    [
      "diff --git a/src/cli.ts b/src/cli.ts",
      "--- a/src/cli.ts",
      "+++ b/src/cli.ts",
      "+export const x = 1;",
    ].join("\n"),
  );
  assert.equal(changes[0]?.path, "src/cli.ts");
});
