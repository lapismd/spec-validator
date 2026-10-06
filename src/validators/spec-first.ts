import { diagnostic } from "../diagnostics.js";
import type { ChangeConfirmation } from "../layout-types.js";
import { changesFromVcs } from "./spec-first-vcs.js";
export { changesFromVcs, parseUnifiedDiff } from "./spec-first-vcs.js";

import type {
  Diagnostic,
  ResolvedValidators,
  ValidationContext,
} from "../types.js";

export const name = "specFirst";

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
  inputOptions: Partial<Exclude<ResolvedValidators["specFirst"], false>>,
  confirmations: ChangeConfirmation[] = [],
): SpecFirstResult {
  const options: Exclude<ResolvedValidators["specFirst"], false> = {
    mode: "mapped",
    canonicalPattern: "^spec/src/(?!SUMMARY\\.md$).+\\.md$",
    ignore: [],
    rules: [],
    protected: [],
    conditional: {},
    ...inputOptions,
  };
  const canonicalSpecPattern = new RegExp(options.canonicalPattern);
  const ignore = options.ignore.map((pattern) => new RegExp(pattern));
  const rules = options.rules.map((rule) => ({
    ...rule,
    pattern: new RegExp(rule.pattern),
  }));
  const protectedPatterns = options.protected.map(
    (pattern) => new RegExp(pattern),
  );
  const changes = new Map<string, SpecFirstChange>();
  for (const input of inputChanges) {
    const change = typeof input === "string" ? { path: input } : input;
    const normalized = normalizePath(change.path);
    if (!normalized) continue;
    changes.set(normalized, {
      path: normalized,
      changedLines: change.changedLines ?? [],
    });
  }
  const files = [...changes.keys()].sort();
  const specFiles = files.filter((file) => canonicalSpecPattern.test(file));
  const protectedFiles: string[] = [];
  const required = new Map<string, string[]>();
  const unmappedProductionFiles: string[] = [];

  for (const file of files) {
    if (canonicalSpecPattern.test(file)) continue;
    const change = changes.get(file)!;
    const matched = rules.flatMap((rule) => {
      const match = rule.pattern.exec(file);
      rule.pattern.lastIndex = 0;
      if (!match) return [];
      if (rule.changedLines) {
        const changed = new RegExp(rule.changedLines);
        if (
          change.changedLines?.length &&
          !change.changedLines.some((line) => changed.test(line))
        ) {
          return [];
        }
      }
      const capture = match[rule.captureGroup ?? 1];
      const chapters =
        rule.chapters ??
        (capture ? rule.captureMap?.[capture] : undefined) ??
        rule.defaultChapters ??
        [];
      return [
        {
          chapters: [
            ...chapters,
            ...(rule.chapterPatterns ?? []).map(
              (pattern) => `pattern:${pattern}`,
            ),
          ],
        },
      ];
    });
    if (!matched.length && ignore.some((pattern) => pattern.test(file))) {
      continue;
    }
    const conditional = options.conditional[file];
    const conditionallyProtected = conditional
      ? !change.changedLines?.length ||
        change.changedLines.some((line) => new RegExp(conditional).test(line))
      : false;
    if (matched.length) {
      protectedFiles.push(file);
      if (
        options.mode === "mapped" &&
        matched.every((rule) => !rule.chapters.length)
      ) {
        unmappedProductionFiles.push(file);
      }
      for (const rule of matched) {
        for (const chapter of rule.chapters) {
          const owners = required.get(chapter) ?? [];
          owners.push(file);
          required.set(chapter, owners);
        }
      }
    } else if (
      conditionallyProtected ||
      protectedPatterns.some((pattern) => pattern.test(file))
    ) {
      if (options.mode === "mapped") unmappedProductionFiles.push(file);
      else protectedFiles.push(file);
    }
  }

  const requiredChapters = [...required.keys()].sort();
  const missingChapters =
    options.mode === "any"
      ? protectedFiles.length && !specFiles.length
        ? [contextualAnyChapter(options)]
        : []
      : requiredChapters.filter((chapter) => {
          const owns = (candidate: string) =>
            chapter.startsWith("pattern:")
              ? new RegExp(chapter.slice(8)).test(candidate)
              : chapter === candidate;
          if (specFiles.some(owns)) return false;
          return !confirmations.some(
            (c) =>
              c.reason?.trim() &&
              files.includes(c.evidence) &&
              c.chapters?.some(owns) &&
              required.get(chapter)!.every((owner) => c.paths?.includes(owner)),
          );
        });
  return {
    files,
    specFiles,
    protectedFiles,
    requiredChapters,
    missingChapters,
    unmappedProductionFiles,
    requiresSpec:
      protectedFiles.length > 0 || unmappedProductionFiles.length > 0,
    ok: missingChapters.length === 0 && unmappedProductionFiles.length === 0,
  };
}

function contextualAnyChapter(
  _options: Exclude<ResolvedValidators["specFirst"], false>,
): string {
  return "spec/src/<canonical-chapter>.md";
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
      options.confirmationProvider?.(context.model.repoRoot, {}) ?? [],
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
