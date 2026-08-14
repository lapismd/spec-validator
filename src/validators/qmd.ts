import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import type { ValidationContext } from "../types.js";

export const name = "qmd";

export function validate(context: ValidationContext) {
  const options = context.config.validators.qmd;
  if (options === false) return [];
  const rule = context.config.ruleIds.qmd;
  const findings = [];
  const configPath = path.join(context.model.repoRoot, options.configPath);
  if (!existsSync(configPath)) {
    return [
      diagnostic({
        code: "SPEC-QMD-MISSING",
        rule,
        file: options.configPath,
        message: "tracked QMD specification configuration is missing",
      }),
    ];
  }
  const source = readFileSync(configPath, "utf8");
  if (!source.includes(`${options.collection}:`)) {
    findings.push(
      diagnostic({
        code: "SPEC-QMD-COLLECTION",
        rule,
        file: options.configPath,
        subject: options.collection,
        message: `QMD config must declare collection ${options.collection}`,
      }),
    );
  }
  if (!/path:\s*spec\/src/.test(source)) {
    findings.push(
      diagnostic({
        code: "SPEC-QMD-PATH",
        rule,
        file: options.configPath,
        message: "QMD collection path must be spec/src",
      }),
    );
  }
  const ignorePath = path.join(context.model.repoRoot, ".gitignore");
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  if (!/\.qmd\/index\.sqlite/.test(ignore)) {
    findings.push(
      diagnostic({
        code: "SPEC-QMD-IGNORE",
        rule,
        file: ".gitignore",
        message: "add .qmd/index.sqlite* to .gitignore",
      }),
    );
  }
  for (const tracked of context.trackedFiles) {
    if (tracked.startsWith(".qmd/index.sqlite")) {
      findings.push(
        diagnostic({
          code: "SPEC-QMD-TRACKED",
          rule,
          file: tracked,
          message: "generated QMD database state must remain untracked",
        }),
      );
    }
  }
  return findings;
}
