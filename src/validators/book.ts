import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { diagnostic } from "../diagnostics.js";
import type { ValidationContext } from "../types.js";

export const name = "book";

export function validate(context: ValidationContext) {
  const options = context.config.validators.book;
  if (options === false) return [];
  const findings = [];
  const rule = context.config.ruleIds.book;
  const ignoreRule = context.config.ruleIds.bookIgnore;
  const configPath = path.join(context.model.repoRoot, "spec", "book.toml");
  if (!existsSync(configPath)) {
    findings.push(
      diagnostic({
        code: "SPEC-BOOK-MISSING",
        rule,
        file: "spec/book.toml",
        message: "mdBook configuration is missing",
      }),
    );
  } else {
    const config = readFileSync(configPath, "utf8");
    if (
      !new RegExp(`^\\s*src\\s*=\\s*"${options.src}"\\s*$`, "m").test(config)
    ) {
      findings.push(
        diagnostic({
          code: "SPEC-BOOK-CONFIG",
          rule,
          file: "spec/book.toml",
          message: `[book] src must be "${options.src}"`,
        }),
      );
    }
    if (
      !new RegExp(
        `^\\s*build-dir\\s*=\\s*"${options.buildDir}"\\s*$`,
        "m",
      ).test(config)
    ) {
      findings.push(
        diagnostic({
          code: "SPEC-BOOK-CONFIG",
          rule,
          file: "spec/book.toml",
          message: `build-dir must be "${options.buildDir}"`,
        }),
      );
    }
  }
  const ignorePath = path.join(context.model.repoRoot, ".gitignore");
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  if (!/^\/?spec\/book\/?\s*$/m.test(ignore)) {
    findings.push(
      diagnostic({
        code: "SPEC-BOOK-IGNORE",
        rule: ignoreRule,
        file: ".gitignore",
        message: "add spec/book/ to .gitignore",
      }),
    );
  }
  for (const tracked of context.trackedFiles) {
    if (tracked === "spec/book" || tracked.startsWith("spec/book/")) {
      findings.push(
        diagnostic({
          code: "SPEC-BOOK-TRACKED",
          rule: ignoreRule,
          file: tracked,
          message:
            "generated mdBook output must remain untracked; untrack the path",
        }),
      );
    }
  }
  return findings;
}
