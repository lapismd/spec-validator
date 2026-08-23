import { assertCommandArgs, hasFlag, readFlag, UsageError } from "../argv.js";
import { findConfigPath } from "../config.js";
import {
  DENO_TASKS,
  PACKAGE_SCRIPT_ALIASES,
  renderDenoVersionCheck,
} from "../deno-contract.js";
import {
  existsSync,
  mkdirSync,
  path,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "../platform/current.js";
import type { Reporter } from "../reporter.js";
import { installSkill } from "./skill.js";

function specSources(repoRoot: string): string {
  const directory = path.join(repoRoot, "spec/src");
  if (!existsSync(directory)) return "";
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => readFileSync(path.join(directory, entry.name), "utf8"))
    .join("\n");
}

function detectShape(repoRoot: string, explicit?: string) {
  if (explicit && explicit !== "heading" && explicit !== "table") {
    throw new UsageError("--profile must be heading or table");
  }
  const source = specSources(repoRoot);
  const style =
    explicit ??
    (/^\|\s*[A-Z][A-Z0-9-]+-\d{3}\s*\|/m.test(source) ? "table" : "heading");
  const ids = [
    ...source.matchAll(/\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3})\b/g),
  ].map((match) => match[1]!);
  const sample = ids[0] ?? "SPEC-REQ-001";
  const escapedPrefix = sample
    .replace(/-\d{3}$/, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const governance = ids.find((id) => id.includes("-GOV-")) ?? sample;
  return {
    style,
    idPattern: `^${escapedPrefix.replace(/-[A-Z0-9]+$/, "-[A-Z]+")}-\\d{3}$`,
    governance,
  };
}

function packageName(repoRoot: string): string {
  const manifestPath = path.join(repoRoot, "package.json");
  if (!existsSync(manifestPath)) return path.basename(repoRoot);
  return (
    (JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: string })
      .name ?? path.basename(repoRoot)
  );
}

function configObject(repoRoot: string, profile?: string) {
  const shape = detectShape(repoRoot, profile);
  return {
    name: packageName(repoRoot),
    idPattern: shape.idPattern,
    requirementStyle: shape.style,
    ruleIds: {
      summary: shape.governance,
      governance: shape.governance,
      verification: shape.governance,
      book: shape.governance,
      bookIgnore: shape.governance,
      internal: shape.governance,
    },
    validators: {
      summary: true,
      governance:
        shape.style === "heading"
          ? true
          : {
              acceptance: false,
              normative: false,
              proseLimits: false,
              references: false,
              changeMap: false,
            },
      verification: true,
      book: true,
    },
  };
}

function renderConfig(
  repoRoot: string,
  extension: string,
  profile?: string,
): string {
  const config = configObject(repoRoot, profile);
  if (extension === ".json") return `${JSON.stringify(config, null, 2)}\n`;
  const serialized = JSON.stringify(config, null, 2)
    .replace('"idPattern": "', '"idPattern": /')
    .replace('",\n  "requirementStyle"', '/,\n  "requirementStyle"')
    .replace(/"([^"\n]+)":/g, "$1:");
  return `import { defineConfig } from "@lapismd/spec-validator";\n\nexport default defineConfig(${serialized});\n`;
}

function writeIfMissing(filePath: string, contents: string): boolean {
  if (existsSync(filePath)) return false;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  return true;
}

function ensureIgnore(repoRoot: string, line: string): boolean {
  const ignorePath = path.join(repoRoot, ".gitignore");
  const current = existsSync(ignorePath)
    ? readFileSync(ignorePath, "utf8")
    : "";
  if (current.split(/\r?\n/).some((entry) => entry.trim() === line)) {
    return false;
  }
  writeFileSync(
    ignorePath,
    `${current.endsWith("\n") || !current ? current : `${current}\n`}${line}\n`,
  );
  return true;
}

function ensureDenoContract(repoRoot: string): string[] {
  const written: string[] = [];
  const denoPath = path.join(repoRoot, "deno.json");
  const denoConfig = existsSync(denoPath)
    ? (JSON.parse(readFileSync(denoPath, "utf8")) as {
        tasks?: Record<string, string>;
      })
    : {};
  denoConfig.tasks ??= {};
  let denoChanged = !existsSync(denoPath);
  for (const [name, command] of Object.entries(DENO_TASKS)) {
    if (denoConfig.tasks[name]) continue;
    denoConfig.tasks[name] = command;
    denoChanged = true;
  }
  if (denoChanged) {
    writeFileSync(denoPath, `${JSON.stringify(denoConfig, null, 2)}\n`);
    written.push("deno.json");
  }
  if (
    writeIfMissing(
      path.join(repoRoot, "scripts/check-deno-version.ts"),
      renderDenoVersionCheck(),
    )
  ) {
    written.push("scripts/check-deno-version.ts");
  }
  return written;
}

export function initCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): number {
  assertCommandArgs(argv, {
    boolean: ["--force", "--skill"],
    value: ["--profile"],
  });
  const force = hasFlag(argv, "--force");
  const profile = readFlag(argv, "--profile");
  const written: string[] = [];
  const existing = findConfigPath(repoRoot);
  if (existing && !force) {
    throw new UsageError(
      `${path.basename(existing)} already exists; pass --force to replace it`,
    );
  }
  const extension = existing ? path.extname(existing) : ".ts";
  const configPath =
    existing ?? path.join(repoRoot, `spec-validator.config${extension}`);
  writeFileSync(configPath, renderConfig(repoRoot, extension, profile));
  written.push(path.basename(configPath));

  if (
    writeIfMissing(
      path.join(repoRoot, "spec/book.toml"),
      `[book]\ntitle = "Specification"\nlanguage = "en"\nsrc = "src"\n\n[build]\nbuild-dir = "book"\ncreate-missing = false\n`,
    )
  ) {
    written.push("spec/book.toml");
  }
  if (
    writeIfMissing(
      path.join(repoRoot, "spec/src/SUMMARY.md"),
      "# Summary\n\n- [Specification](index.md)\n- [Verification](verification.md)\n",
    )
  ) {
    written.push("spec/src/SUMMARY.md");
  }
  if (
    writeIfMissing(
      path.join(repoRoot, "spec/src/index.md"),
      "# Specification\n\nCanonical requirements live here.\n",
    )
  ) {
    written.push("spec/src/index.md");
  }
  if (
    writeIfMissing(
      path.join(repoRoot, "spec/src/verification.md"),
      "# Verification\n\n| Requirement | Status | Evidence |\n| --- | --- | --- |\n",
    )
  ) {
    written.push("spec/src/verification.md");
  }
  if (ensureIgnore(repoRoot, "spec/book/")) written.push(".gitignore");
  written.push(...ensureDenoContract(repoRoot));

  const packagePath = path.join(repoRoot, "package.json");
  if (existsSync(packagePath)) {
    const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    manifest.scripts ??= {};
    let changed = false;
    for (const [name, script] of Object.entries(PACKAGE_SCRIPT_ALIASES)) {
      if (manifest.scripts[name]) continue;
      manifest.scripts[name] = script;
      changed = true;
    }
    if (changed) {
      writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
      written.push("package.json");
    }
  }
  if (hasFlag(argv, "--skill")) written.push(installSkill());
  reporter.writeReport({
    version: 1,
    ok: true,
    exitCode: 0,
    message: `Initialized ${profile ?? "detected"} profile. Wrote ${
      written.join(", ") || "no new files"
    }.`,
  });
  return 0;
}
