import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { validate } from "./governance.js";

function validateTable(source: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-table-"));
  try {
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    writeFileSync(path.join(root, "spec/src/requirements.md"), source);
    const config = resolveConfig({
      idPattern: /^FIX-REQ-\d{3}$/,
      requirementStyle: "table",
      tableSection: "Requirements",
      minAcceptance: 3,
      maxAcceptance: null,
      ruleIds: { governance: "FIX-GOV-001", internal: "FIX-GOV-001" },
      validators: {
        governance: {
          acceptance: true,
          acceptanceScope: "declared",
          acceptanceIntroduction: "require",
          acceptanceAtomic: false,
          acceptanceColocation: true,
        },
      },
    });
    const context = createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    });
    return validate(context);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("table governance reports malformed rows and invalid IDs", () => {
  const findings = validateTable(
    [
      "# Requirements",
      "",
      "## Requirements",
      "",
      "| ID | Requirement |",
      "| --- | --- |",
      "| BAD-001 | It exists. |",
      "| FIX-REQ-001 | It MUST work. | unexpected |",
    ].join("\n"),
  );
  const codes = new Set(findings.map((finding) => finding.code));
  assert.equal(codes.has("SPEC-REQ-ID"), true);
  assert.equal(codes.has("SPEC-REQ-NORMATIVE"), true);
  assert.equal(codes.has("SPEC-REQ-TABLE"), true);
});

test("declared table acceptance requires colocated details, an introduction, and minimum bullets", () => {
  const valid = validateTable(
    [
      "# Requirements",
      "",
      "## Requirements",
      "",
      "| ID | Requirement |",
      "| --- | --- |",
      "| FIX-REQ-001 | It MUST work. |",
      "",
      "### FIX-REQ-001 acceptance details",
      "",
      "The scenario verifies:",
      "",
      "- First",
      "- Second",
      "- Third",
    ].join("\n"),
  );
  assert.deepEqual(valid, []);

  const invalid = validateTable(
    [
      "# Requirements",
      "",
      "## Requirements",
      "",
      "| ID | Requirement |",
      "| --- | --- |",
      "| FIX-REQ-001 | It MUST work. |",
      "",
      "### FIX-REQ-999 acceptance details",
      "",
      "- First",
      "- Second",
    ].join("\n"),
  );
  const codes = invalid.map((finding) => finding.code);
  assert.equal(
    codes.filter((code) => code === "SPEC-REQ-DETAILS-ID").length,
    1,
  );
  assert.equal(
    codes.filter((code) => code === "SPEC-REQ-DETAILS-LIST").length,
    2,
  );
});

test("table acceptance ignores fenced authoring examples", () => {
  const findings = validateTable(
    [
      "# Requirements",
      "",
      "## Requirements",
      "",
      "| ID | Requirement |",
      "| --- | --- |",
      "| FIX-REQ-001 | It MUST work. |",
      "",
      "```markdown",
      "### FIX-REQ-999 acceptance details",
      "",
      "The example shows:",
      "",
      "- First",
      "- Second",
      "- Third",
      "```",
    ].join("\n"),
  );
  assert.deepEqual(findings, []);
});
