import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import type { ValidationContext } from "../types.js";

export const name = "packageDocs";

function expand(template: string, name: string): string {
  return template.replaceAll("<name>", name);
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.packageDocs;
  if (options === false) return [];
  const root = path.join(context.model.repoRoot, options.root);
  if (!existsSync(root)) return [];
  const rule = context.config.ruleIds.packageDocs;
  const matcher = new RegExp(options.packagePattern);
  const findings: ReturnType<typeof diagnostic>[] = [];
  const packages = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const match = matcher.exec(entry.name);
      matcher.lastIndex = 0;
      return match?.[1] ? [{ directory: entry.name, name: match[1] }] : [];
    });
  for (const pkg of packages) {
    const chapter = expand(options.chapterTemplate, pkg.name);
    const chapterPath = path.join(context.model.sourceDirectory, chapter);
    if (!existsSync(chapterPath)) {
      findings.push(
        diagnostic({
          code: "SPEC-PACKAGE-DOC-MISSING",
          rule,
          file: `${options.root}/${pkg.directory}`,
          subject: chapter,
          message: "package has no configured canonical chapter",
        }),
      );
      continue;
    }
    const identity = expand(options.identityTemplate, pkg.name);
    if (identity && !readFileSync(chapterPath, "utf8").includes(identity)) {
      findings.push(
        diagnostic({
          code: "SPEC-PACKAGE-DOC-IDENTITY",
          rule,
          file: `${context.config.specDir}/${chapter}`,
          subject: identity,
          message:
            "canonical package chapter is missing its configured identity",
        }),
      );
    }
  }
  return findings;
}
