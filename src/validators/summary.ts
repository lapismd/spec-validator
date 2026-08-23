import { diagnostic } from "../diagnostics.js";
import { groupBy, localMarkdownTargets, toPosix } from "../model.js";
import { existsSync, path } from "../platform/current.js";
import type { ValidationContext } from "../types.js";

export const name = "summary";

function withoutFragment(target: string): string {
  return target.split("#", 1)[0]!;
}

export function validate(context: ValidationContext) {
  const findings = [];
  const rule = context.config.ruleIds.summary;
  const summary = context.model.files.find(
    (file) => file.chapterPath === "SUMMARY.md",
  );
  if (!summary) {
    return [
      diagnostic({
        code: "SPEC-SUMMARY-MISSING",
        rule,
        file: `${context.config.specDir}/SUMMARY.md`,
        message: "canonical chapter index is missing; restore SUMMARY.md",
      }),
    ];
  }
  const targets = localMarkdownTargets(summary.source)
    .map(withoutFragment)
    .filter((target) => target.endsWith(".md"))
    .map((target) =>
      toPosix(path.normalize(path.join(path.dirname("SUMMARY.md"), target))),
    );
  const counts = groupBy(targets, (target) => target);
  const chapters = context.model.files
    .map((file) => file.chapterPath)
    .filter((chapter) => chapter !== "SUMMARY.md");
  for (const chapter of chapters) {
    const count = counts.get(chapter)?.length ?? 0;
    if (count !== 1) {
      findings.push(
        diagnostic({
          code: "SPEC-SUMMARY-ENTRY",
          rule,
          file: `${context.config.specDir}/${chapter}`,
          subject: chapter,
          message: `expected exactly one SUMMARY.md entry, found ${count}`,
        }),
      );
    }
  }
  for (const target of counts.keys()) {
    if (!chapters.includes(target)) {
      findings.push(
        diagnostic({
          code: "SPEC-SUMMARY-STALE",
          rule,
          file: `${context.config.specDir}/SUMMARY.md`,
          subject: target,
          message:
            "indexed chapter does not exist; remove or correct the entry",
        }),
      );
    }
  }
  for (const file of context.model.files) {
    const lines = file.source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      for (const target of localMarkdownTargets(lines[index]!)) {
        const local = withoutFragment(target);
        if (!local) continue;
        if (existsSync(path.resolve(path.dirname(file.absolutePath), local))) {
          continue;
        }
        findings.push(
          diagnostic({
            code: "SPEC-LINK-BROKEN",
            rule,
            file: file.relativePath,
            line: index + 1,
            subject: target,
            message:
              "local Markdown target does not exist; fix the link or restore the file",
          }),
        );
      }
    }
  }
  return findings;
}
