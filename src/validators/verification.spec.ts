import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { validate } from "./verification.js";

test("verification supports a configured grouped-ID table and prefix statuses", () => {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "spec-validator-verification-"),
  );
  try {
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    writeFileSync(
      path.join(root, "spec/src/requirements.md"),
      [
        "# Requirements",
        "",
        "| ID | Requirement |",
        "| --- | --- |",
        "| FIX-REQ-001 | The engine MUST parse grouped IDs. |",
        "| FIX-REQ-002 | The engine MUST accept status details. |",
      ].join("\n"),
    );
    writeFileSync(
      path.join(root, "spec/src/verification.md"),
      [
        "# Verification",
        "",
        "## Matrix",
        "",
        "| Requirements | Evidence | Audit state |",
        "| --- | --- | --- |",
        "| FIX-REQ-001, FIX-REQ-002 | fixture | Implemented - focused |",
      ].join("\n"),
    );
    const config = resolveConfig({
      idPattern: /^FIX-REQ-\d{3}$/,
      requirementStyle: "table",
      ruleIds: { verification: "FIX-REQ-001", internal: "FIX-REQ-001" },
      validators: {
        verification: {
          section: "Matrix",
          headers: {
            ids: ["Requirements"],
            evidence: ["Evidence"],
            status: ["Audit state"],
          },
          idMode: "grouped",
          statuses: ["Implemented"],
          statusMatch: "prefix",
        },
      },
    });
    const context = createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    });
    assert.deepEqual(validate(context), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verification can allow multiple evidence rows for one requirement", () => {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "spec-validator-verification-many-"),
  );
  try {
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    writeFileSync(
      path.join(root, "spec/src/requirements.md"),
      "| ID | Requirement |\n| --- | --- |\n| FIX-REQ-001 | The engine MUST retain multiple evidence rows. |\n",
    );
    writeFileSync(
      path.join(root, "spec/src/verification.md"),
      [
        "| Requirements | Evidence | Status |",
        "| --- | --- | --- |",
        "| FIX-REQ-001 | unit | Implemented |",
        "| FIX-REQ-001 | integration | Implemented |",
      ].join("\n"),
    );
    const config = resolveConfig({
      idPattern: /^FIX-REQ-\d{3}$/,
      requirementStyle: "table",
      ruleIds: { verification: "FIX-REQ-001", internal: "FIX-REQ-001" },
      validators: {
        verification: {
          headers: {
            ids: ["Requirements"],
            evidence: ["Evidence"],
            status: ["Status"],
          },
          idMode: "grouped",
          statuses: ["Implemented"],
          rowMultiplicity: "at-least-one",
        },
      },
    });
    const context = createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    });
    assert.deepEqual(validate(context), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
