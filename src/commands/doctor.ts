import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { hasFlag } from "../argv.js";
import { findConfigPath, loadResolvedConfig } from "../config.js";
import type { Reporter } from "../reporter.js";
import type { DoctorCheck } from "../types.js";
import { resolveQmdBinary } from "./search.js";
import { globalSkillPath, installSkill } from "./skill.js";

function which(command: string): boolean {
  const result = process.env.PATH?.split(path.delimiter).some((directory) =>
    existsSync(path.join(directory, command)),
  );
  return Boolean(result);
}

export async function doctorCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  const fix = hasFlag(argv, "--fix");
  const strict = hasFlag(argv, "--strict");
  const checks: DoctorCheck[] = [];
  const repairs: string[] = [];

  const configPath = findConfigPath(repoRoot);
  if (!configPath) {
    checks.push({
      name: "config",
      status: "fail",
      message: "missing spec-validator.config.ts; run spec-validator init",
      fixable: false,
    });
  } else {
    try {
      const config = await loadResolvedConfig(repoRoot);
      checks.push({
        name: "config",
        status: "pass",
        message: `loaded ${path.basename(configPath)} (preset ${config.preset})`,
      });

      const specDir = path.join(repoRoot, config.specDir);
      for (const file of ["SUMMARY.md", "verification.md"]) {
        const relative = `${config.specDir}/${file}`;
        checks.push({
          name: relative,
          status: existsSync(path.join(specDir, file)) ? "pass" : "fail",
          message: existsSync(path.join(specDir, file))
            ? "present"
            : "missing canonical chapter",
        });
      }
      const bookPath = path.join(repoRoot, "spec/book.toml");
      if (config.validators.book) {
        checks.push({
          name: "book.toml",
          status: existsSync(bookPath) ? "pass" : "fail",
          message: existsSync(bookPath) ? "present" : "missing spec/book.toml",
          fixable: true,
        });
        if (fix && !existsSync(bookPath)) {
          writeFileSync(
            bookPath,
            `[book]\ntitle = "Specification"\nlanguage = "en"\nsrc = "src"\n\n[build]\nbuild-dir = "book"\n`,
          );
          repairs.push("spec/book.toml");
        }
      }

      const ignorePath = path.join(repoRoot, ".gitignore");
      const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
      const hasBookIgnore = /^\/?spec\/book\/?\s*$/m.test(ignore);
      checks.push({
        name: "gitignore-book",
        status: hasBookIgnore ? "pass" : "fail",
        message: hasBookIgnore ? "spec/book/ ignored" : "add spec/book/ to .gitignore",
        fixable: true,
      });
      if (fix && !hasBookIgnore) {
        writeFileSync(
          ignorePath,
          `${ignore.endsWith("\n") || !ignore ? ignore : `${ignore}\n`}spec/book/\n`,
        );
        repairs.push(".gitignore");
      }

      if (config.validators.qmd) {
        const qmdPath = path.join(repoRoot, config.validators.qmd.configPath);
        const qmdPresent = existsSync(qmdPath);
        checks.push({
          name: "qmd-config",
          status: qmdPresent ? "pass" : "fail",
          message: qmdPresent ? "QMD config present" : "missing .qmd/index.yml",
          fixable: true,
        });
        if (fix && !qmdPresent) {
          writeFileSync(
            qmdPath,
            `collections:\n  ${config.validators.qmd.collection}:\n    path: spec/src\n    pattern: "**/*.md"\n`,
          );
          repairs.push(config.validators.qmd.configPath);
        }
        const binary = resolveQmdBinary(repoRoot);
        checks.push({
          name: "qmd-binary",
          status: existsSync(binary) ? "pass" : "warn",
          message: existsSync(binary)
            ? "local qmd binary present"
            : "optional qmd binary missing; search will fall back to rg",
        });
      }

      checks.push({
        name: "mdbook",
        status: which("mdbook") ? "pass" : "warn",
        message: which("mdbook") ? "mdbook is on PATH" : "mdbook is not on PATH",
      });

      const packagePath = path.join(repoRoot, "package.json");
      if (existsSync(packagePath)) {
        const scripts = (
          JSON.parse(readFileSync(packagePath, "utf8")) as {
            scripts?: Record<string, string>;
          }
        ).scripts ?? {};
        const wired = Object.values(scripts).some(
          (script) =>
            script.includes("spec-validator") || script.includes("dist/cli.js"),
        );
        checks.push({
          name: "scripts",
          status: wired ? "pass" : "warn",
          message: wired
            ? "package.json scripts call spec-validator"
            : "package.json scripts do not yet call spec-validator",
          fixable: true,
        });
        if (fix && !wired) {
          const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
            scripts?: Record<string, string>;
          };
          manifest.scripts = {
            ...manifest.scripts,
            "spec:validate": "spec-validator validate",
            "spec:check": "spec-validator check",
          };
          writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
          repairs.push("package.json");
        }
      }

      const skillPath = globalSkillPath();
      const skillPresent = existsSync(skillPath);
      checks.push({
        name: "skill",
        status: skillPresent ? "pass" : "warn",
        message: skillPresent
          ? `skill installed at ${skillPath}`
          : `skill not installed at ${path.join(os.homedir(), ".agents/skills/spec-validator/SKILL.md")}`,
        fixable: true,
      });
      if (fix && !skillPresent) {
        repairs.push(installSkill());
      }
    } catch (error) {
      checks.push({
        name: "config",
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (fix && repairs.length) {
    checks.push({
      name: "repairs",
      status: "pass",
      message: `applied ${repairs.join(", ")}`,
    });
  }

  const failed = checks.some((check) => check.status === "fail");
  const warned = checks.some((check) => check.status === "warn");
  const ok = !failed && (!strict || !warned);
  reporter.writeReport({
    version: 1,
    ok,
    exitCode: ok ? 0 : 1,
    checks,
  });
  return ok ? 0 : 1;
}
