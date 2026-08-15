import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import type { ValidationContext } from "../types.js";

export const name = "repositoryLayout";

export function validate(context: ValidationContext) {
  const options = context.config.validators.repositoryLayout;
  if (options === false) return [];
  const rule = context.config.ruleIds.repositoryLayout;
  const findings: ReturnType<typeof diagnostic>[] = [];
  for (const file of options.requiredFiles) {
    if (existsSync(path.join(context.model.repoRoot, file))) continue;
    findings.push(
      diagnostic({
        code: "SPEC-LAYOUT-REQUIRED",
        rule,
        file,
        message: "required repository file or directory is missing",
      }),
    );
  }
  for (const entry of options.forbiddenEntries) {
    if (!existsSync(path.join(context.model.repoRoot, entry))) continue;
    findings.push(
      diagnostic({
        code: "SPEC-LAYOUT-FORBIDDEN",
        rule,
        file: entry,
        message: "filesystem entry is forbidden by repository layout policy",
      }),
    );
  }
  for (const pattern of options.forbiddenPaths) {
    const matcher = new RegExp(pattern);
    for (const tracked of context.trackedFiles.filter((file) =>
      matcher.test(file),
    )) {
      findings.push(
        diagnostic({
          code: "SPEC-LAYOUT-FORBIDDEN",
          rule,
          file: tracked,
          message: "path is forbidden by repository layout policy",
        }),
      );
    }
  }
  if (options.allowedRootMarkdown.length) {
    const actual = readdirSync(context.model.repoRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
    for (const file of actual) {
      if (options.allowedRootMarkdown.includes(file)) continue;
      findings.push(
        diagnostic({
          code: "SPEC-LAYOUT-ROOT-MARKDOWN",
          rule,
          file,
          message: `package-root Markdown is limited to ${options.allowedRootMarkdown.join(", ")}`,
        }),
      );
    }
  }
  return findings;
}
