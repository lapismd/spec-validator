import { diagnostic } from "../diagnostics.js";
import { existsSync, path, readFileSync } from "../platform/current.js";
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
  for (const [scope, selection] of Object.entries(options.scopes)) {
    if (
      !selection.path.startsWith(`${context.config.specDir}/`) &&
      selection.path !== context.config.specDir
    )
      throw new Error(`scope ${scope} escapes canonical source`);
    if (
      !source.includes(`${selection.collection}:`) ||
      !source.includes(`path: ${selection.path}`)
    )
      findings.push(
        diagnostic({
          code: "SPEC-QMD-SCOPE",
          rule,
          file: options.configPath,
          subject: scope,
          message: "declare the scoped collection and canonical source path",
        }),
      );
  }
  if (options.defaultScope && !options.scopes[options.defaultScope])
    throw new Error("defaultScope is not declared");
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
