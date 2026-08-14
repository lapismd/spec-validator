import { diagnostic } from "../diagnostics.js";
import { groupBy, splitMarkdownTableRow } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "verification";

export function validate(context: ValidationContext) {
  const options = context.config.validators.verification;
  if (options === false) return [];
  const rule = context.config.ruleIds.verification;
  const file = context.model.files.find(
    (candidate) => candidate.chapterPath === "verification.md",
  );
  if (!file) {
    return [
      diagnostic({
        code: "SPEC-VERIFY-MISSING",
        rule,
        file: `${context.config.specDir}/verification.md`,
        message: "verification matrix is missing; restore the canonical chapter",
      }),
    ];
  }

  const rows: Array<{
    id: string;
    status: string;
    evidence: string;
    line: number;
  }> = [];
  const findings = [];
  for (const [index, line] of file.source.split(/\r?\n/).entries()) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = splitMarkdownTableRow(line);
    if (!cells) continue;
    if (
      cells[0] === options.header ||
      cells[0] === "Requirement" ||
      (cells[0] && /^:?-+:?$/.test(cells[0].replaceAll(" ", "")))
    ) {
      continue;
    }
    if (cells.length !== options.columns || !context.config.idPattern.test(cells[0]!)) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-TABLE",
          rule,
          file: file.relativePath,
          line: index + 1,
          message: `verification row must contain ${options.columns} cells starting with a requirement ID`,
        }),
      );
      continue;
    }
    const status = options.columns === 4 ? cells[2]! : cells[1]!;
    const evidence = options.columns === 4 ? cells[3]! : cells[2]!;
    rows.push({ id: cells[0]!, status, evidence, line: index + 1 });
  }

  const rowsById = groupBy(rows, (row) => row.id);
  for (const definition of context.model.definitions) {
    const count = rowsById.get(definition.id)?.length ?? 0;
    if (count !== 1) {
      findings.push(
        diagnostic({
          code: count === 0 ? "SPEC-VERIFY-UNMAPPED" : "SPEC-VERIFY-DUPLICATE",
          rule,
          file: definition.file,
          line: definition.line,
          subject: definition.id,
          message:
            count === 0
              ? "requirement has no verification row"
              : `requirement has ${count} verification rows`,
        }),
      );
    }
  }
  for (const row of rows) {
    if (!context.model.definitionsById.has(row.id)) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-ORPHAN",
          rule,
          file: file.relativePath,
          line: row.line,
          subject: row.id,
          message: "verification row has no canonical requirement definition",
        }),
      );
    }
    if (!row.evidence) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-EVIDENCE",
          rule,
          file: file.relativePath,
          line: row.line,
          subject: row.id,
          message: "evidence must identify a source, scenario, or validation command",
        }),
      );
    }
    if (!options.statuses.includes(row.status)) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-STATUS",
          rule,
          file: file.relativePath,
          line: row.line,
          subject: row.id,
          message: `unsupported status “${row.status || "(empty)"}”; use ${options.statuses.join(", ")}`,
        }),
      );
    }
  }
  return findings;
}
