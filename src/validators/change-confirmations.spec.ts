import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changesFromVcs, classifySpecFirstChanges } from "./spec-first.js";
const options = {
  canonicalPattern: "^spec/current/contracts/.*\\.md$",
  rules: [
    {
      pattern: "^web/",
      chapterPatterns: ["^spec/current/contracts/ui/.*\\.md$"],
    },
  ],
  protected: ["^web/"],
};
test("mapped topic alternatives reject unrelated topics and accept the owner", () => {
  assert.equal(
    classifySpecFirstChanges(
      ["web/view.ts", "spec/current/contracts/ui/view.md"],
      options,
    ).ok,
    true,
  );
  assert.equal(
    classifySpecFirstChanges(
      ["web/view.ts", "spec/current/contracts/storage/view.md"],
      options,
    ).ok,
    false,
  );
});
test("unchanged confirmation requires fresh evidence and every protected owner", () => {
  const confirmation = {
    paths: ["web/view.ts"],
    chapters: ["spec/current/contracts/ui/view.md"],
    reason: "Extracted rendering with retained interaction evidence",
    evidence: "spec/history/E-TEST.md",
  };
  assert.equal(
    classifySpecFirstChanges(["web/view.ts", confirmation.evidence], options, [
      confirmation,
    ]).ok,
    true,
  );
  assert.equal(
    classifySpecFirstChanges(["web/view.ts"], options, [confirmation]).ok,
    false,
  );
  assert.equal(
    classifySpecFirstChanges(
      ["web/view.ts", "web/other.ts", confirmation.evidence],
      options,
      [confirmation],
    ).ok,
    false,
  );
});
test("explicit JJ ranges use JJ without a colocated Git checkout", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-jj-range-"));
  mkdirSync(join(root, ".jj"));
  const calls: string[][] = [];
  try {
    changesFromVcs({ base: "first", head: "last" }, root, (command, args) => {
      calls.push([command, ...args]);
      return "";
    });
    assert.equal(calls[0]![0], "jj");
    assert.ok(calls[0]!.includes("first"));
    assert.ok(calls[0]!.includes("last"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
