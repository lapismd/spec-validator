import { diagnostic } from "../diagnostics.js";
import { groupBy, splitMarkdownTableRow } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "verification";

interface VerificationRow {
  ids: string[];
  status: string;
  evidence: string;
  required: string[];
  line: number;
}

function sameHeader(value: string, choices: string[] | undefined): boolean {
  return Boolean(
    choices?.some(
      (choice) => choice.trim().toLowerCase() === value.trim().toLowerCase(),
    ),
  );
}

function sectionRange(lines: string[], section?: string): [number, number] {
  if (!section) return [0, lines.length];
  const start = lines.findIndex((line) => {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    return match?.[1]?.toLowerCase() === section.toLowerCase();
  });
  if (start < 0) return [-1, -1];
  const level = /^#+/.exec(lines[start]!)?.[0].length ?? 1;
  for (let index = start + 1; index < lines.length; index += 1) {
    const heading = /^(#+)\s+/.exec(lines[index]!);
    if (heading && heading[1]!.length <= level) return [start + 1, index];
  }
  return [start + 1, lines.length];
}

function idsFromCell(
  cell: string,
  context: ValidationContext,
  grouped: boolean,
): string[] {
  if (!grouped) {
    const value = cell.replaceAll("`", "").trim();
    const exact = new RegExp(context.config.idPattern.source);
    return exact.test(value) ? [value] : [];
  }
  const pattern = new RegExp(
    context.config.idPattern.source.replace(/^\^|\$$/g, ""),
    "g",
  );
  return [...cell.matchAll(pattern)].map((match) => match[0]);
}

function referenceRows(
  source: string,
  context: ValidationContext,
): VerificationRow[] {
  const pattern = new RegExp(
    context.config.idPattern.source.replace(/^\^|\$$/g, ""),
    "g",
  );
  return [...source.matchAll(pattern)].map((match) => ({
    ids: [match[0]],
    status: "",
    evidence: source,
    required: [],
    line: source.slice(0, match.index ?? 0).split(/\r?\n/).length,
  }));
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.verification;
  if (options === false) return [];
  const rule = context.config.ruleIds.verification;
  const file = context.model.files.find(
    (candidate) => candidate.chapterPath === options.file,
  );
  if (!file) {
    return [
      diagnostic({
        code: "SPEC-VERIFY-MISSING",
        rule,
        file: `${context.config.specDir}/${options.file}`,
        message:
          "verification matrix is missing; restore the canonical chapter",
      }),
    ];
  }

  const findings = [];
  let rows: VerificationRow[] = [];
  if (options.mode === "references") {
    rows = referenceRows(file.source, context);
  } else {
    const lines = file.source.split(/\r?\n/);
    const [start, end] = sectionRange(lines, options.section);
    if (start < 0) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-TABLE",
          rule,
          file: file.relativePath,
          message: `verification section “${options.section}” is missing`,
        }),
      );
      return findings;
    }
    let headerIndex = -1;
    let idIndex = -1;
    let statusIndex = -1;
    let evidenceIndex = -1;
    let requiredIndexes: number[] = [];
    for (let index = start; index < end; index += 1) {
      const cells = splitMarkdownTableRow(lines[index]!);
      if (!cells) continue;
      const candidateId = cells.findIndex((cell) =>
        sameHeader(cell, options.headers.ids),
      );
      if (candidateId < 0) continue;
      headerIndex = index;
      idIndex = candidateId;
      statusIndex = cells.findIndex((cell) =>
        sameHeader(cell, options.headers.status),
      );
      evidenceIndex = cells.findIndex((cell) =>
        sameHeader(cell, options.headers.evidence),
      );
      requiredIndexes = (options.headers.required ?? []).map((aliases) =>
        cells.findIndex((cell) => sameHeader(cell, aliases)),
      );
      if (
        (options.headers.status?.length && statusIndex < 0) ||
        (options.requireEvidence &&
          options.headers.evidence?.length &&
          evidenceIndex < 0) ||
        requiredIndexes.some((value) => value < 0)
      ) {
        findings.push(
          diagnostic({
            code: "SPEC-VERIFY-TABLE",
            rule,
            file: file.relativePath,
            line: index + 1,
            message: "verification table is missing a configured column",
          }),
        );
        return findings;
      }
      break;
    }
    if (headerIndex < 0) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-TABLE",
          rule,
          file: file.relativePath,
          message: "configured verification table header was not found",
        }),
      );
      return findings;
    }
    for (let index = headerIndex + 2; index < end; index += 1) {
      const line = lines[index]!;
      if (!/^\s*\|/.test(line)) break;
      const cells = splitMarkdownTableRow(line);
      if (!cells) break;
      const ids = idsFromCell(
        cells[idIndex] ?? "",
        context,
        options.idMode === "grouped",
      );
      if (!ids.length) {
        findings.push(
          diagnostic({
            code: "SPEC-VERIFY-TABLE",
            rule,
            file: file.relativePath,
            line: index + 1,
            message:
              "verification row must start with configured requirement IDs",
          }),
        );
        continue;
      }
      rows.push({
        ids,
        status: statusIndex < 0 ? "" : (cells[statusIndex] ?? ""),
        evidence: evidenceIndex < 0 ? "" : (cells[evidenceIndex] ?? ""),
        required: requiredIndexes.map((column) => cells[column] ?? ""),
        line: index + 1,
      });
    }
  }

  const expanded = rows.flatMap((row) => row.ids.map((id) => ({ ...row, id })));
  const rowsById = groupBy(expanded, (row) => row.id);
  for (const definition of context.model.definitions) {
    const count = rowsById.get(definition.id)?.length ?? 0;
    if (
      count === 0 ||
      (options.rowMultiplicity === "exactly-one" && count !== 1)
    ) {
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
  for (const row of expanded) {
    if (options.rejectOrphans && !context.model.definitionsById.has(row.id)) {
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
    if (
      options.requireEvidence &&
      (!row.evidence.trim() || row.required.some((cell) => !cell.trim()))
    ) {
      findings.push(
        diagnostic({
          code: "SPEC-VERIFY-EVIDENCE",
          rule,
          file: file.relativePath,
          line: row.line,
          subject: row.id,
          message: "configured evidence columns must be non-empty",
        }),
      );
    }
    if (options.statuses.length && options.mode === "table") {
      const accepted = options.statuses.some((status) =>
        options.statusMatch === "prefix"
          ? row.status.startsWith(status)
          : row.status === status,
      );
      if (!accepted) {
        findings.push(
          diagnostic({
            code: "SPEC-VERIFY-STATUS",
            rule,
            file: file.relativePath,
            line: row.line,
            subject: row.id,
            message: `unsupported status “${row.status || "(empty)"}”; use ${options.statuses.join(
              ", ",
            )}`,
          }),
        );
      }
    }
  }
  return findings;
}
