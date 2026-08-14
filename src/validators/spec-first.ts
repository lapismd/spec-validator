import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import { toPosix } from "../model.js";
import type { Diagnostic, ValidationContext } from "../types.js";

export const name = "specFirst";

const CANONICAL_SPEC_PATTERN = /^spec\/src\/(?!SUMMARY\.md$).+\.md$/;

export interface SpecFirstChange {
  path: string;
  changedLines?: string[];
}

export interface SpecFirstResult {
  files: string[];
  specFiles: string[];
  protectedFiles: string[];
  requiredChapters: string[];
  missingChapters: string[];
  unmappedProductionFiles: string[];
  requiresSpec: boolean;
  ok: boolean;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function classifySpecFirstChanges(
  inputChanges: Array<string | SpecFirstChange>,
  options: { ignore: string[]; rules: Array<{ pattern: string; chapters: string[] }>; protected: string[] },
): SpecFirstResult {
  const ignore = options.ignore.map((pattern) => new RegExp(pattern));
  const rules = options.rules.map((rule) => ({
    pattern: new RegExp(rule.pattern),
    chapters: rule.chapters,
  }));
  const protectedPatterns = options.protected.map((pattern) => new RegExp(pattern));
  const changes = new Map<string, SpecFirstChange>();
  for (const input of inputChanges) {
    const change = typeof input === "string" ? { path: input } : input;
    const normalized = normalizePath(change.path);
    if (!normalized) continue;
    changes.set(normalized, { path: normalized, changedLines: change.changedLines ?? [] });
  }
  const files = [...changes.keys()].sort();
  const specFiles = files.filter((file) => CANONICAL_SPEC_PATTERN.test(file));
  const protectedFiles: string[] = [];
  const required = new Map<string, string[]>();
  const unmappedProductionFiles: string[] = [];

  for (const file of files) {
    if (CANONICAL_SPEC_PATTERN.test(file)) continue;
    if (ignore.some((pattern) => pattern.test(file))) continue;
    const matched = rules.filter((rule) => rule.pattern.test(file));
    if (matched.length) {
      protectedFiles.push(file);
      for (const rule of matched) {
        for (const chapter of rule.chapters) {
          const owners = required.get(chapter) ?? [];
          owners.push(file);
          required.set(chapter, owners);
        }
      }
    } else if (protectedPatterns.some((pattern) => pattern.test(file))) {
      unmappedProductionFiles.push(file);
    }
  }

  const requiredChapters = [...required.keys()].sort();
  const missingChapters = requiredChapters.filter((chapter) => !specFiles.includes(chapter));
  return {
    files,
    specFiles,
    protectedFiles,
    requiredChapters,
    missingChapters,
    unmappedProductionFiles,
    requiresSpec: protectedFiles.length > 0 || unmappedProductionFiles.length > 0,
    ok: missingChapters.length === 0 && unmappedProductionFiles.length === 0,
  };
}

function parseDiffHeader(line: string): [string, string] | null {
  const source = line.slice("diff --git ".length);
  const match =
    /^(?:"((?:[^"\\]|\\.)*)"|(\S+))\s+(?:"((?:[^"\\]|\\.)*)"|(\S+))$/.exec(source);
  if (!match) return null;
  const decode = (quoted: string | undefined, plain: string | undefined) => {
    const value = quoted === undefined ? plain : JSON.parse(`"${quoted}"`);
    return value?.replace(/^[ab]\//, "");
  };
  try {
    const before = decode(match[1], match[2]);
    const after = decode(match[3], match[4]);
    return before && after ? [before, after] : null;
  } catch {
    return null;
  }
}

export function parseUnifiedDiff(source: string): SpecFirstChange[] {
  const changes = new Map<string, SpecFirstChange>();
  let currentPaths: string[] = [];
  let sawHeader = false;
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const header = parseDiffHeader(line);
      if (!header) throw new Error(`unsupported unified diff header: ${line}`);
      sawHeader = true;
      currentPaths = [...new Set(header.map(normalizePath))];
      for (const currentPath of currentPaths) {
        if (!changes.has(currentPath))
          changes.set(currentPath, { path: currentPath, changedLines: [] });
      }
      continue;
    }
    if (!currentPaths.length || line.startsWith("+++") || line.startsWith("---"))
      continue;
    if (line.startsWith("+") || line.startsWith("-")) {
      for (const currentPath of currentPaths)
        changes.get(currentPath)!.changedLines!.push(line.slice(1));
    }
  }
  if (source.trim() && !sawHeader) {
    throw new Error("non-empty change-set output contained no unified diff headers");
  }
  return [...changes.values()];
}

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`,
    );
  }
  return result.stdout;
}

export function changesFromVcs(
  options: { base?: string; head?: string; files?: string[] },
  repoRoot: string,
  execute = run,
): SpecFirstChange[] {
  if (options.files?.length) return options.files.map((file) => ({ path: toPosix(file) }));
  if (options.base) {
    return parseUnifiedDiff(
      execute(
        "git",
        ["diff", "--no-ext-diff", "--unified=0", options.base, options.head ?? "HEAD", "--"],
        repoRoot,
      ),
    );
  }
  if (existsSync(path.join(repoRoot, ".jj"))) {
    return parseUnifiedDiff(
      execute(
        "jj",
        ["--no-pager", "--color=never", "diff", "--git", "--from", "@-", "--to", "@"],
        repoRoot,
      ),
    );
  }
  if (existsSync(path.join(repoRoot, ".git"))) {
    return parseUnifiedDiff(
      execute("git", ["diff", "--no-ext-diff", "--unified=0", "HEAD", "--"], repoRoot),
    );
  }
  throw new Error(
    "neither .jj nor .git is available; pass --base/--head or explicit --file paths",
  );
}

export function findingsFromResult(
  result: SpecFirstResult,
  rule: string,
): Diagnostic[] {
  return [
    ...result.missingChapters.map((chapter) =>
      diagnostic({
        code: "SPEC-FIRST-MISSING",
        rule,
        file: chapter,
        message: "protected change is missing its mapped canonical chapter",
      }),
    ),
    ...result.unmappedProductionFiles.map((file) =>
      diagnostic({
        code: "SPEC-FIRST-UNMAPPED",
        rule,
        file,
        message: "protected file has no spec-first chapter mapping",
      }),
    ),
  ];
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.specFirst;
  if (options === false) return [];
  try {
    const result = classifySpecFirstChanges(
      changesFromVcs({}, context.model.repoRoot),
      options,
    );
    return findingsFromResult(result, context.config.ruleIds.specFirst);
  } catch (error) {
    return [
      diagnostic({
        code: "SPEC-FIRST-VCS",
        rule: context.config.ruleIds.specFirst,
        file: "spec/src/spec-governance.md",
        message: error instanceof Error ? error.message : String(error),
      }),
    ];
  }
}
