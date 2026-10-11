import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { validate as verification } from "./verification.js";
import { validate as limits } from "./file-limits.js";
function fixture(
  files: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  const root = mkdtempSync(join(tmpdir(), "spec-layout-"));
  for (const [name, value] of Object.entries(files)) {
    mkdirSync(join(root, "spec/src", name, ".."), { recursive: true });
    writeFileSync(join(root, "spec/src", name), value);
  }
  const config = resolveConfig({
    ruleIds: {
      internal: "SV-VAL-004",
      fileLimits: "SV-VAL-004",
      verification: "SV-VAL-004",
    },
    diagnostics: { "*": "SV-VAL-004" },
    requirementStyle: "table",
    tableSection: "Requirements",
    documentRoles: [{ pattern: "^verification/", role: "verification" }],
    ...extra,
  });
  return {
    context: createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    }),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
const req =
  "# Contract\n\n## Requirements\n\n| ID | Requirement |\n| --- | --- |\n| SV-VAL-001 | It MUST work. |\n";
const row =
  "| ID | Status | Evidence |\n| --- | --- | --- |\n| SV-VAL-001 | Implemented | exact proof |\n";
test("verification covers multiple files globally without defining requirements", () => {
  const f = fixture(
    { "contract.md": req, "verification/a.md": row },
    { validators: { verification: { files: ["^verification/.*\\.md$"] } } },
  );
  try {
    assert.equal(f.context.model.definitions.length, 1);
    assert.deepEqual(verification(f.context), []);
  } finally {
    f.cleanup();
  }
});
test("verification rejects duplicates across files and empty file selections", () => {
  const f = fixture(
    { "contract.md": req, "verification/a.md": row, "verification/b.md": row },
    { validators: { verification: { files: ["^verification/.*\\.md$"] } } },
  );
  try {
    assert.ok(
      verification(f.context).some((d) => d.code === "SPEC-VERIFY-DUPLICATE"),
    );
  } finally {
    f.cleanup();
  }
  const empty = fixture(
    { "contract.md": req },
    { validators: { verification: { files: ["^verification/.*\\.md$"] } } },
  );
  try {
    assert.ok(
      verification(empty.context).some((d) => d.code === "SPEC-VERIFY-MISSING"),
    );
  } finally {
    empty.cleanup();
  }
});
test("physical lines and UTF-8 bytes include fences and wide tables", () => {
  const f = fixture(
    { "oversized.md": "# Example\n```text\nααααα\n```\n" },
    { validators: { fileLimits: { maxLines: 3, maxBytes: 10 } } },
  );
  try {
    assert.deepEqual(
      limits(f.context).map((d) => d.code),
      ["SPEC-FILE-LINES", "SPEC-FILE-BYTES"],
    );
  } finally {
    f.cleanup();
  }
});
