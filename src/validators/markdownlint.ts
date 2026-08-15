import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import type { ValidationContext } from "../types.js";

export const name = "markdownlint";

export function validate(context: ValidationContext) {
  const options = context.config.validators.markdownlint;
  if (options === false) return [];
  const rule = context.config.ruleIds.markdownlint;
  const configPath = path.join(context.model.repoRoot, options.config);
  const args = existsSync(configPath) ? ["--config", options.config] : [];
  const binary = path.join(
    context.model.repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32"
      ? "markdownlint-cli2.cmd"
      : "markdownlint-cli2",
  );
  const result = spawnSync(
    existsSync(binary) ? binary : "markdownlint-cli2",
    args,
    {
      cwd: context.model.repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    },
  );
  if (
    !existsSync(binary) &&
    result.error &&
    (result.error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    return [
      diagnostic({
        code: "SPEC-MDLINT-MISSING",
        rule,
        file: options.config,
        message:
          "markdownlint-cli2 is not installed; add it as a development dependency",
      }),
    ];
  }
  if (result.status === 0) return [];
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return [
    diagnostic({
      code: "SPEC-MDLINT",
      rule,
      file: options.config,
      message: output || "markdownlint-cli2 failed",
    }),
  ];
}
