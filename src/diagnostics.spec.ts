import assert from "node:assert/strict";
import { test } from "node:test";

import { compareDiagnostics, diagnostic, formatDiagnostic } from "./diagnostics.js";

test("formatDiagnostic includes optional subject", () => {
  const finding = diagnostic({
    code: "SPEC-REQ-WORDS",
    rule: "SV-GOV-001",
    file: "spec/src/cli.md",
    line: 12,
    subject: "SV-CLI-001",
    message: "too long",
  });
  assert.equal(
    formatDiagnostic(finding),
    "SPEC-REQ-WORDS SV-GOV-001 spec/src/cli.md:12 [SV-CLI-001] — too long",
  );
});

test("compareDiagnostics sorts by file, line, code, subject", () => {
  const findings = [
    diagnostic({ code: "B", rule: "R", file: "b.md", line: 1, message: "x" }),
    diagnostic({ code: "A", rule: "R", file: "a.md", line: 2, message: "x" }),
    diagnostic({ code: "A", rule: "R", file: "a.md", line: 1, message: "x" }),
  ].sort(compareDiagnostics);
  assert.deepEqual(
    findings.map((item) => `${item.file}:${item.line}:${item.code}`),
    ["a.md:1:A", "a.md:2:A", "b.md:1:B"],
  );
});
