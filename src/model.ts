import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type {
  AcceptanceSection,
  CoverageRow,
  ParsedRequirementFile,
  RequirementDefinition,
  ResolvedConfig,
  SpecFile,
  SpecModel,
} from "./types.js";

export const NORMATIVE_PATTERN = /\b(?:MUST|MUST NOT|SHOULD|SHOULD NOT|MAY)\b/;

export function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const current = groups.get(id) ?? [];
    current.push(item);
    groups.set(id, current);
  }
  return groups;
}

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function relativePath(repoRoot: string, absolutePath: string): string {
  return toPosix(path.relative(repoRoot, absolutePath));
}

export function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(absolutePath);
      return entry.isFile() && entry.name.endsWith(".md") ? [absolutePath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

export function splitMarkdownTableRow(line: string): string[] | null {
  const source = line.trim();
  if (!source.startsWith("|") || !source.endsWith("|")) return null;
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  let codeDelimiter = 0;
  for (let index = 1; index < source.length - 1; index += 1) {
    const character = source[index]!;
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (character === "`") {
      let runLength = 1;
      while (source[index + runLength] === "`") runLength += 1;
      if (codeDelimiter === 0) codeDelimiter = runLength;
      else if (codeDelimiter === runLength) codeDelimiter = 0;
      current += "`".repeat(runLength);
      index += runLength - 1;
      continue;
    }
    if (character === "|" && codeDelimiter === 0) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

export function markdownToProse(source: string): string {
  return source
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`+([^`]+)`+/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_~>#]/g, " ")
    .replace(/\\([\\`*{}\[\]()#+.!|_-])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function proseMetrics(source: string): {
  prose: string;
  words: number;
  sentences: number;
} {
  const prose = markdownToProse(source);
  const words = prose.match(/[\p{L}\p{N}]+(?:['’/-][\p{L}\p{N}]+)*/gu) ?? [];
  const sentences = prose.match(/[.!?]+(?=\s|$)/g) ?? [];
  return { prose, words: words.length, sentences: sentences.length };
}

export function withoutFencedCode(source: string): string {
  let fenced = false;
  return source
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

export function localMarkdownTargets(source: string): string[] {
  const targets: string[] = [];
  for (const match of source.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
    const target = match[1]!.trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#|\?)/.test(target)) continue;
    targets.push(target);
  }
  return targets;
}

function nextHeading(
  lines: string[],
  start: number,
  levelPattern: RegExp,
): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (levelPattern.test(lines[index]!)) return index;
  }
  return lines.length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headingPattern(config: ResolvedConfig): RegExp {
  const [beforeId, afterId = ""] = config.headingTemplate.split("<ID>");
  const [beforeSurface, afterSurface = ""] = afterId.split("<surface>");
  const id = config.idPattern.source.replace(/^\^|\$$/g, "");
  const surface = afterId.includes("<surface>") ? "(.+)" : "";
  return new RegExp(
    `^${escapeRegExp(beforeId!)}(${id})${escapeRegExp(beforeSurface!)}${surface}${escapeRegExp(afterSurface!)}\\s*$`,
  );
}

function parseHeadingRequirements(
  file: SpecFile,
  config: ResolvedConfig,
): ParsedRequirementFile {
  const lines = file.source.split(/\r?\n/);
  const definitions: RequirementDefinition[] = [];
  const malformed: Array<{ line: number; reason: string }> = [];
  const acceptanceSections: AcceptanceSection[] = [];
  const coverage: CoverageRow[] = [];
  const heading = headingPattern(config);
  const prefix = config.idPattern.source.match(/^\^([A-Z]+)/)?.[1] ?? "";
  const headingStart = prefix
    ? new RegExp(`^##\\s+${prefix}-`)
    : /^##\s+[A-Z]+-/;

  for (let index = 0; index < lines.length; index += 1) {
    if (headingStart.test(lines[index]!)) {
      const match = heading.exec(lines[index]!);
      if (!match) {
        malformed.push({
          line: index + 1,
          reason: `requirement heading must match “${config.headingTemplate}” and ${config.idPattern}`,
        });
        continue;
      }
      const end = nextHeading(lines, index, /^##\s+/);
      const body = lines.slice(index + 1, end);
      const statementLine = body.findIndex((line) =>
        /^\*\*Requirement\.\*\*\s+/.test(line),
      );
      const statement =
        statementLine < 0
          ? ""
          : body[statementLine]!.replace(
              /^\*\*Requirement\.\*\*\s+/,
              "",
            ).trim();
      const acceptanceHeading = body.findIndex((line) =>
        /^###\s+Acceptance details\s*$/.test(line),
      );
      const acceptanceBody =
        acceptanceHeading < 0 ? [] : body.slice(acceptanceHeading + 1);
      const firstBullet = acceptanceBody.findIndex((line) =>
        /^-\s+/.test(line),
      );
      const nonBullet = acceptanceBody.filter(
        (line) => line.trim() && !/^-\s+/.test(line),
      );
      const bullets = acceptanceBody
        .map((line, bodyIndex) => ({
          line,
          lineNumber: index + acceptanceHeading + bodyIndex + 3,
        }))
        .filter((entry) => /^-\s+/.test(entry.line))
        .map((entry) => {
          const text = entry.line.replace(/^-\s+/, "").trim();
          return {
            statement: text,
            line: entry.lineNumber,
            ...proseMetrics(text),
          };
        });
      definitions.push({
        id: match[1]!,
        surface: match[2],
        statement,
        file: file.relativePath,
        chapterPath: file.chapterPath,
        line: index + 1,
        ...proseMetrics(statement),
      });
      acceptanceSections.push({
        id: match[1]!,
        file: file.relativePath,
        line: acceptanceHeading < 0 ? index + 1 : index + acceptanceHeading + 2,
        present: acceptanceHeading >= 0,
        introduction: acceptanceBody
          .slice(0, firstBullet < 0 ? acceptanceBody.length : firstBullet)
          .some((line) => line.trim().length > 0),
        nonBullet,
        bullets,
      });
      index = end - 1;
      continue;
    }
    if (/^##\s+Public surface coverage\s*$/.test(lines[index]!)) {
      const end = nextHeading(lines, index, /^##\s+/);
      for (let rowIndex = index + 1; rowIndex < end; rowIndex += 1) {
        const cells = splitMarkdownTableRow(lines[rowIndex]!);
        if (!cells || cells.length !== 3 || cells[0] === "Surface") continue;
        if (/^-+$/.test(cells[0]!.replaceAll(" ", ""))) continue;
        coverage.push({
          surface: cells[0]!,
          boundary: cells[1]!,
          id: cells[2]!.replaceAll("`", "").trim(),
          file: file.relativePath,
          line: rowIndex + 1,
        });
      }
    }
  }
  return { file, definitions, malformed, acceptanceSections, coverage };
}

function parseTableRequirements(
  file: SpecFile,
  config: ResolvedConfig,
): ParsedRequirementFile {
  const lines = file.source.split(/\r?\n/);
  const definitions: RequirementDefinition[] = [];
  const malformed: Array<{ line: number; reason: string }> = [];
  const acceptanceSections: AcceptanceSection[] = [];
  let inRequirements = config.tableSection === null;
  let requirementSectionLevel = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]!);
    if (config.tableSection && heading?.[2] === config.tableSection) {
      inRequirements = true;
      requirementSectionLevel = heading[1]!.length;
      continue;
    }
    if (
      config.tableSection &&
      inRequirements &&
      heading &&
      heading[1]!.length <= requirementSectionLevel
    ) {
      inRequirements = false;
    }
    if (!inRequirements) continue;
    if (!/^\s*\|/.test(lines[index]!)) continue;
    const cells = splitMarkdownTableRow(lines[index]!);
    if (!cells || cells.length !== 2) {
      if (config.tableSection) {
        malformed.push({
          line: index + 1,
          reason: "expected exactly two table cells",
        });
      }
      continue;
    }
    const id = cells[0]!;
    const statement = cells[1]!;
    if (id === "ID" || /^:?-+:?$/.test(id.replaceAll(" ", ""))) continue;
    const validId = config.idPattern.test(id);
    if (!config.tableSection && !validId) continue;
    definitions.push({
      id,
      statement,
      file: file.relativePath,
      chapterPath: file.chapterPath,
      line: index + 1,
      validId,
      ...proseMetrics(statement),
    });
  }

  const acceptanceHeading = new RegExp(
    `^###\\s+(${config.idPattern.source.slice(1, -1)}) acceptance details\\s*$`,
  );
  for (let index = 0; index < lines.length; index += 1) {
    const match = acceptanceHeading.exec(lines[index]!);
    if (!match) continue;
    const end = nextHeading(lines, index, /^#{1,3}\s+/);
    const body = lines.slice(index + 1, end);
    const firstBullet = body.findIndex((line) => /^-\s+/.test(line));
    const bullets = body
      .map((line, bodyIndex) => ({ line, lineNumber: index + bodyIndex + 2 }))
      .filter((entry) => /^-\s+/.test(entry.line))
      .map((entry) => {
        const text = entry.line.replace(/^-\s+/, "").trim();
        return {
          statement: text,
          line: entry.lineNumber,
          ...proseMetrics(text),
        };
      });
    acceptanceSections.push({
      id: match[1]!,
      file: file.relativePath,
      line: index + 1,
      present: true,
      introduction: body
        .slice(0, firstBullet < 0 ? body.length : firstBullet)
        .some((line) => line.trim().length > 0),
      nonBullet: body.filter((line) => line.trim() && !/^-\s+/.test(line)),
      bullets,
    });
  }

  return { file, definitions, malformed, acceptanceSections, coverage: [] };
}

export function parseRequirementFile(
  file: SpecFile,
  config: ResolvedConfig,
): ParsedRequirementFile {
  return config.requirementStyle === "table"
    ? parseTableRequirements(file, config)
    : parseHeadingRequirements(file, config);
}

export function createSpecModel(
  repoRoot: string,
  config: ResolvedConfig,
): SpecModel {
  const sourceDirectory = path.join(repoRoot, config.specDir);
  const files = markdownFiles(sourceDirectory).map((absolutePath) => ({
    absolutePath,
    relativePath: relativePath(repoRoot, absolutePath),
    chapterPath: toPosix(path.relative(sourceDirectory, absolutePath)),
    source: readFileSync(absolutePath, "utf8"),
  }));
  const canonicalFiles = files.filter(
    (file) => !["SUMMARY.md", "verification.md"].includes(file.chapterPath),
  );
  const parsed = canonicalFiles.map((file) =>
    parseRequirementFile(file, config),
  );
  const definitions = parsed.flatMap((entry) => entry.definitions);
  const acceptanceSections = parsed.flatMap(
    (entry) => entry.acceptanceSections,
  );
  const coverage = parsed.flatMap((entry) => entry.coverage);
  return {
    repoRoot,
    sourceDirectory,
    files,
    canonicalFiles,
    parsed,
    definitions,
    acceptanceSections,
    coverage,
    definitionsById: groupBy(definitions, (definition) => definition.id),
    coverageById: groupBy(coverage, (entry) => entry.id),
  };
}
