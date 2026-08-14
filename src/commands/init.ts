import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hasFlag, readFlag } from "../argv.js";
import { findConfigPath } from "../config.js";
import { PRESETS } from "../presets.js";
import type { Reporter } from "../reporter.js";
import { installSkill } from "./skill.js";

const SCRIPT_ALIASES: Record<string, string> = {
  "spec:validate": "spec-validator validate",
  "spec:check": "spec-validator check",
  "spec:first": "spec-validator first",
  "spec:build": "spec-validator build",
  "spec:search": "spec-validator search",
  "spec:index": "spec-validator index",
};

function detectPreset(repoRoot: string, explicit?: string): string {
  if (explicit) return explicit;
  if (!existsSync(path.join(repoRoot, "package.json"))) return "spec-validator";
  const name = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"))
    .name as string | undefined;
  if (name === "@lapismd/design-core") return "design-core";
  if (name === "lapis-notes") return "lapis-notes";
  if (name === "mira-workspace" || name?.startsWith("@lapismd/mira")) return "mira";
  if (name === "@lapismd/storybook-addon-visual-delta") return "visual-delta";
  if (name === "@lapis-notes/lapis-plugin-cv-roles") return "cv-roles";
  if (name === "@lapismd/spec-validator") return "spec-validator";
  return "spec-validator";
}

function writeIfMissing(filePath: string, contents: string, force: boolean): boolean {
  if (existsSync(filePath) && !force) return false;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  return true;
}

function ensureIgnore(repoRoot: string, line: string): boolean {
  const ignorePath = path.join(repoRoot, ".gitignore");
  const current = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  if (current.split(/\r?\n/).some((entry) => entry.trim() === line)) return false;
  writeFileSync(ignorePath, `${current.endsWith("\n") || !current ? current : `${current}\n`}${line}\n`);
  return true;
}

export function initCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): number {
  const presetName = detectPreset(repoRoot, readFlag(argv, "--preset"));
  if (!PRESETS[presetName]) {
    reporter.writeError(`Unknown preset: ${presetName}`);
    return 2;
  }
  const force = hasFlag(argv, "--force");
  const written: string[] = [];
  const existing = findConfigPath(repoRoot);
  if (existing && !force) {
    reporter.writeError(`${path.basename(existing)} already exists; pass --force to replace it`);
    return 2;
  }
  const configPath = path.join(repoRoot, "spec-validator.config.ts");
  writeFileSync(
    configPath,
    `import { defineConfig } from "@lapismd/spec-validator";\n\nexport default defineConfig({\n  preset: "${presetName}",\n});\n`,
  );
  written.push("spec-validator.config.ts");

  writeIfMissing(
    path.join(repoRoot, "spec/book.toml"),
    `[book]\ntitle = "Specification"\nlanguage = "en"\nsrc = "src"\n\n[build]\nbuild-dir = "book"\ncreate-missing = false\n`,
    false,
  ) && written.push("spec/book.toml");
  writeIfMissing(
    path.join(repoRoot, "spec/src/SUMMARY.md"),
    "# Summary\n\n- [Specification](index.md)\n- [Verification](verification.md)\n",
    false,
  ) && written.push("spec/src/SUMMARY.md");
  writeIfMissing(
    path.join(repoRoot, "spec/src/index.md"),
    "# Specification\n\nCanonical requirements live here.\n",
    false,
  ) && written.push("spec/src/index.md");
  writeIfMissing(
    path.join(repoRoot, "spec/src/verification.md"),
    "# Verification\n\n| Requirement | Status | Evidence |\n| --- | --- | --- |\n",
    false,
  ) && written.push("spec/src/verification.md");

  const preset = PRESETS[presetName]!;
  if (preset.validators?.qmd) {
    const collection =
      typeof preset.validators.qmd === "object"
        ? preset.validators.qmd.collection
        : "spec";
    writeIfMissing(
      path.join(repoRoot, ".qmd/index.yml"),
      `collections:\n  ${collection}:\n    path: spec/src\n    pattern: "**/*.md"\n`,
      false,
    ) && written.push(".qmd/index.yml");
    if (ensureIgnore(repoRoot, ".qmd/index.sqlite*")) written.push(".gitignore");
  }
  if (ensureIgnore(repoRoot, "spec/book/")) written.push(".gitignore");

  const packagePath = path.join(repoRoot, "package.json");
  if (existsSync(packagePath)) {
    const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    manifest.scripts ??= {};
    let changed = false;
    for (const [name, script] of Object.entries(SCRIPT_ALIASES)) {
      if (!manifest.scripts[name]) {
        manifest.scripts[name] = script;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
      written.push("package.json");
    }
  }

  if (hasFlag(argv, "--skill")) {
    written.push(installSkill());
  }

  reporter.writeReport({
    version: 1,
    ok: true,
    exitCode: 0,
    message: `Initialized ${presetName} preset. Wrote ${written.join(", ") || "no new files"}.`,
  });
  return 0;
}
