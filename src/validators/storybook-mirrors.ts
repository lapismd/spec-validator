import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import { relativePath, toPosix } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "storybookMirrors";

function summaryEntries(context: ValidationContext) {
  const summary = context.model.files.find((file) => file.chapterPath === "SUMMARY.md");
  if (!summary) return [];
  return summary.source.split(/\r?\n/).flatMap((line, index) => {
    const match = /^\s*-\s+\[([^\]]+)]\(([^)#]+\.md)(?:#[^)]+)?\)\s*$/.exec(line);
    if (!match) return [];
    return [
      {
        label: match[1]!.replaceAll(" / ", "/"),
        chapterPath: toPosix(path.normalize(match[2]!)),
        line: index + 1,
      },
    ];
  });
}

function collectMdx(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const entries: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...collectMdx(absolutePath));
    else if (entry.isFile() && entry.name.endsWith(".mdx")) entries.push(absolutePath);
  }
  return entries.sort();
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.storybookMirrors;
  if (options === false) return [];
  const rule = context.config.ruleIds.storybookMirrors;
  const findings = [];
  const entries = summaryEntries(context);
  const repoRoot = context.model.repoRoot;

  if (options.style === "stories-spec") {
    const directory = path.join(repoRoot, options.directory);
    if (!existsSync(directory)) {
      return [
        diagnostic({
          code: "SPEC-MIRROR-MISSING",
          rule,
          file: options.directory,
          message: "stories/spec is missing",
        }),
      ];
    }
    const mirrors: Array<{ chapter: string; file: string }> = [];
    for (const file of collectMdx(directory)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /import\s+\w+\s+from\s+["'][^"']*spec\/src\/([^"']+\.md)\?raw["']/g,
      )) {
        mirrors.push({
          chapter: toPosix(path.normalize(match[1]!)),
          file: relativePath(repoRoot, file),
        });
      }
    }
    for (const entry of entries) {
      const matching = mirrors.filter((mirror) => mirror.chapter === entry.chapterPath);
      if (matching.length !== 1) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-MISSING",
            rule,
            file: `${context.config.specDir}/${entry.chapterPath}`,
            subject: entry.chapterPath,
            message: `expected one Storybook mirror, found ${matching.length}`,
          }),
        );
      }
    }
    for (const mirror of mirrors) {
      if (!entries.some((entry) => entry.chapterPath === mirror.chapter)) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-STALE",
            rule,
            file: mirror.file,
            subject: mirror.chapter,
            message: "Storybook specification mirror has no SUMMARY chapter",
          }),
        );
      }
    }
    return findings;
  }

  const root = path.join(repoRoot, options.directory);
  const expected = new Map(
    entries.map((entry) => [
      path.resolve(path.join(root, entry.chapterPath.replace(/\.md$/, ".mdx"))),
      entry,
    ]),
  );
  for (const [absolutePath, entry] of expected) {
    const relative = relativePath(repoRoot, absolutePath);
    if (!existsSync(absolutePath)) {
      findings.push(
        diagnostic({
          code: "SPEC-MIRROR-MISSING",
          rule,
          file: relative,
          subject: entry.chapterPath,
          message: "add the metadata-only Storybook mirror for this SUMMARY chapter",
        }),
      );
      continue;
    }
    const source = readFileSync(absolutePath, "utf8");
    const rawImport = /import\s+content\s+from\s+["']([^"']+)\?raw["'];?/.exec(source);
    if (!rawImport) {
      findings.push(
        diagnostic({
          code: "SPEC-MIRROR-IMPORT",
          rule,
          file: relative,
          message: "mirror must import its canonical Markdown as raw content",
        }),
      );
    }
  }
  for (const absolutePath of collectMdx(root)) {
    if (expected.has(path.resolve(absolutePath))) continue;
    findings.push(
      diagnostic({
        code: "SPEC-MIRROR-STALE",
        rule,
        file: relativePath(repoRoot, absolutePath),
        message: "Storybook specification mirror has no SUMMARY chapter",
      }),
    );
  }
  return findings;
}
