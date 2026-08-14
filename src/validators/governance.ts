import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import { NORMATIVE_PATTERN, splitMarkdownTableRow, withoutFencedCode } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "governance";

function lineForOffset(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/).length;
}

export function validate(context: ValidationContext) {
  const findings = [];
  const rule = context.config.ruleIds.governance;
  const extras =
    context.config.validators.governance === false
      ? []
      : context.config.validators.governance.extras;
  const { maxWords, maxSentences, minAcceptance, maxAcceptance } = context.config;

  for (const parsed of context.model.parsed) {
    for (const row of parsed.malformed) {
      findings.push(
        diagnostic({
          code: "SPEC-REQ-HEADING",
          rule,
          file: parsed.file.relativePath,
          line: row.line,
          message: row.reason,
        }),
      );
    }
  }

  for (const definition of context.model.definitions) {
    if (!definition.statement) {
      findings.push(
        diagnostic({
          code: "SPEC-REQ-STATEMENT",
          rule,
          file: definition.file,
          line: definition.line,
          subject: definition.id,
          message:
            "add one “**Requirement.**” statement before acceptance details",
        }),
      );
      continue;
    }
    if (!NORMATIVE_PATTERN.test(definition.statement)) {
      findings.push(
        diagnostic({
          code: "SPEC-REQ-NORMATIVE",
          rule,
          file: definition.file,
          line: definition.line,
          subject: definition.id,
          message:
            "requirement statement needs MUST, MUST NOT, SHOULD, SHOULD NOT, or MAY",
        }),
      );
    }
    if (definition.words > maxWords) {
      findings.push(
        diagnostic({
          code: "SPEC-REQ-WORDS",
          rule,
          file: definition.file,
          line: definition.line,
          subject: definition.id,
          message: `${definition.words} prose words exceed the maximum of ${maxWords}; split the behavior`,
        }),
      );
    }
    if (definition.sentences > maxSentences) {
      findings.push(
        diagnostic({
          code: "SPEC-REQ-SENTENCES",
          rule,
          file: definition.file,
          line: definition.line,
          subject: definition.id,
          message: `${definition.sentences} sentences exceed the maximum of ${maxSentences}; split the behavior`,
        }),
      );
    }
  }

  for (const [id, definitions] of context.model.definitionsById) {
    if (definitions.length === 1) continue;
    for (const definition of definitions) {
      findings.push(
        diagnostic({
          code: "SPEC-REQ-DUPLICATE",
          rule,
          file: definition.file,
          line: definition.line,
          subject: id,
          message: `requirement ID is defined ${definitions.length} times; retain one canonical definition`,
        }),
      );
    }
  }

  if (context.config.requirementStyle === "heading") {
    for (const section of context.model.acceptanceSections) {
      if (!section.present) {
        findings.push(
          diagnostic({
            code: "SPEC-DETAILS-MISSING",
            rule,
            file: section.file,
            line: section.line,
            subject: section.id,
            message: `add an “Acceptance details” subsection with ${minAcceptance} to ${maxAcceptance} atomic bullets`,
          }),
        );
      }
      if (section.nonBullet.length) {
        findings.push(
          diagnostic({
            code: "SPEC-DETAILS-FORM",
            rule,
            file: section.file,
            line: section.line,
            subject: section.id,
            message: "acceptance details may contain only atomic bullet statements",
          }),
        );
      }
      if (
        section.present &&
        (section.bullets.length < minAcceptance ||
          section.bullets.length > maxAcceptance)
      ) {
        findings.push(
          diagnostic({
            code: "SPEC-DETAILS-COUNT",
            rule,
            file: section.file,
            line: section.line,
            subject: section.id,
            message: `expected ${minAcceptance} to ${maxAcceptance} acceptance bullets, found ${section.bullets.length}`,
          }),
        );
      }
      for (const bullet of section.bullets) {
        if (bullet.sentences > 1) {
          findings.push(
            diagnostic({
              code: "SPEC-DETAILS-ATOMIC",
              rule,
              file: section.file,
              line: bullet.line,
              subject: section.id,
              message: "acceptance bullet contains more than one sentence; split it",
            }),
          );
        }
        if (bullet.words > maxWords) {
          findings.push(
            diagnostic({
              code: "SPEC-DETAILS-WORDS",
              rule,
              file: section.file,
              line: bullet.line,
              subject: section.id,
              message: `${bullet.words} prose words exceed the maximum of ${maxWords}`,
            }),
          );
        }
      }
    }
  }

  const references = [
    ...context.model.files,
    ...extras
      .map((relative) => ({
        relativePath: relative,
        source: context.readOptional(path.join(context.model.repoRoot, relative)),
      }))
      .filter((file) => file.source !== null)
      .map((file) => ({ relativePath: file.relativePath, source: file.source! })),
  ];
  for (const file of references) {
    const source = withoutFencedCode(file.source);
    for (const match of source.matchAll(context.config.referencePattern)) {
      if (context.model.definitionsById.has(match[0]!)) continue;
      findings.push(
        diagnostic({
          code: "SPEC-REQ-UNKNOWN",
          rule,
          file: file.relativePath,
          line: lineForOffset(source, match.index ?? 0),
          subject: match[0],
          message: "requirement reference has no canonical definition",
        }),
      );
    }
  }

  const changeMap = context.model.canonicalFiles.find(
    (file) => file.chapterPath === "spec-governance.md",
  );
  if (changeMap) {
    const lines = changeMap.source.split(/\r?\n/);
    const start = lines.findIndex((line) => /^##\s+Change map\s*$/.test(line));
    if (start >= 0) {
      const seen = new Map<string, number>();
      for (let index = start + 1; index < lines.length; index += 1) {
        if (/^##\s+/.test(lines[index]!)) break;
        const cells = splitMarkdownTableRow(lines[index]!);
        if (!cells || cells.length !== 2 || cells[0] === "Protected area") continue;
        if (/^-+$/.test(cells[0]!.replaceAll(" ", ""))) continue;
        const key = cells[0]!.replace(/`/g, "").trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, index + 1);
          continue;
        }
        findings.push(
          diagnostic({
            code: "SPEC-CHANGEMAP-DUPLICATE",
            rule,
            file: changeMap.relativePath,
            line: index + 1,
            subject: cells[0],
            message: "change-map area is listed more than once",
          }),
        );
      }
    }
  }

  return findings;
}
