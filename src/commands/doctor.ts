import { assertCommandArgs, hasFlag } from "../argv.js";
import { findConfigPath, loadResolvedConfig } from "../config.js";
import {
  DENO_TASKS,
  PACKAGE_SCRIPT_ALIASES,
  renderDenoVersionCheck,
} from "../deno-contract.js";
import {
  existsSync,
  mkdirSync,
  os,
  path,
  readFileSync,
  runtime,
  writeFileSync,
} from "../platform/current.js";
import type { Reporter } from "../reporter.js";
import type { DoctorCheck, ResolvedConfig } from "../types.js";
import { resolveQmdBinary } from "./search.js";
import { globalSkillPath, installSkill } from "./skill.js";

function which(command: string): boolean {
  return Boolean(
    runtime.env.PATH?.split(path.delimiter).some((directory) =>
      existsSync(path.join(directory, command)),
    ),
  );
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

function appendIgnore(repoRoot: string, line: string): boolean {
  const file = path.join(repoRoot, ".gitignore");
  const source = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (source.split(/\r?\n/).some((entry) => entry.trim() === line)) {
    return false;
  }
  writeFileSync(
    file,
    `${source.endsWith("\n") || !source ? source : `${source}\n`}${line}\n`,
  );
  return true;
}

async function inspect(
  repoRoot: string,
  skillRequested: boolean,
): Promise<{ checks: DoctorCheck[]; config?: ResolvedConfig }> {
  const checks: DoctorCheck[] = [];
  const configPath = findConfigPath(repoRoot);
  if (!configPath) {
    return {
      checks: [
        {
          name: "config",
          status: "fail",
          message: "missing spec-validator config; run spec-validator init",
        },
      ],
    };
  }
  let config: ResolvedConfig;
  try {
    config = await loadResolvedConfig(repoRoot);
    checks.push({
      name: "config",
      status: "pass",
      message: `loaded ${path.basename(configPath)} (${config.name})`,
    });
  } catch (error) {
    return {
      checks: [
        {
          name: "config",
          status: "fail",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
  for (const file of ["SUMMARY.md", "verification.md"]) {
    const relative = `${config.specDir}/${file}`;
    const present = existsSync(path.join(repoRoot, relative));
    checks.push({
      name: relative,
      status: present ? "pass" : "fail",
      message: present ? "present" : "missing canonical chapter",
    });
  }
  if (config.validators.book) {
    const present = existsSync(path.join(repoRoot, "spec/book.toml"));
    checks.push({
      name: "book.toml",
      status: present ? "pass" : "fail",
      message: present ? "present" : "missing spec/book.toml",
      fixable: true,
    });
  }
  const ignore = existsSync(path.join(repoRoot, ".gitignore"))
    ? readFileSync(path.join(repoRoot, ".gitignore"), "utf8")
    : "";
  const bookIgnored = /^\/?spec\/book\/?\s*$/m.test(ignore);
  checks.push({
    name: "gitignore-book",
    status: bookIgnored ? "pass" : "fail",
    message: bookIgnored
      ? "spec/book/ ignored"
      : "add spec/book/ to .gitignore",
    fixable: true,
  });

  if (config.validators.qmd) {
    const qmdPath = path.join(repoRoot, config.validators.qmd.configPath);
    const source = existsSync(qmdPath) ? readFileSync(qmdPath, "utf8") : "";
    const valid =
      source.includes(config.validators.qmd.collection) &&
      /path:\s*spec\/src/.test(source) &&
      /pattern:\s*["']?\*\*\/\*\.md/.test(source);
    checks.push({
      name: "qmd-config",
      status: valid ? "pass" : "fail",
      message: valid
        ? "QMD collection indexes spec/src/**/*.md"
        : "QMD config is missing or does not match the configured collection",
      fixable: true,
    });
    const binary = resolveQmdBinary(repoRoot);
    checks.push({
      name: "qmd-binary",
      status: existsSync(binary) ? "pass" : "warn",
      message: existsSync(binary)
        ? "local qmd binary present"
        : "optional qmd binary missing; search will fall back to rg",
    });
    const denoPath = path.join(repoRoot, "deno.json");
    const denoConfig = existsSync(denoPath) ? readJson(denoPath) : {};
    const allowScripts = Array.isArray(denoConfig.allowScripts)
      ? denoConfig.allowScripts.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
    const nativeAllowed = ["better-sqlite3", "node-llama-cpp"].every((name) =>
      allowScripts.some((entry) => entry === name || entry === `npm:${name}`),
    );
    checks.push({
      name: "deno-native-builds",
      status: nativeAllowed ? "pass" : "fail",
      message: nativeAllowed
        ? "QMD native builds are allowed in deno.json"
        : "allow better-sqlite3 and node-llama-cpp scripts in deno.json",
    });
  }

  checks.push({
    name: "mdbook",
    status: which("mdbook") ? "pass" : "warn",
    message: which("mdbook") ? "mdbook is on PATH" : "mdbook is not on PATH",
  });
  const denoPath = path.join(repoRoot, "deno.json");
  const denoConfig = existsSync(denoPath) ? readJson(denoPath) : {};
  const denoTasks = (denoConfig.tasks ?? {}) as Record<string, string>;
  const missingDenoTasks = Object.entries(DENO_TASKS).filter(
    ([name, expected]) => denoTasks[name] !== expected,
  );
  checks.push({
    name: "deno-tasks",
    status: missingDenoTasks.length ? "fail" : "pass",
    message: missingDenoTasks.length
      ? `Deno tasks differ: ${missingDenoTasks
          .map(([name]) => name)
          .join(", ")}`
      : "deno.json has the canonical specification tasks",
    fixable: true,
  });
  const versionPath = path.join(repoRoot, "scripts/check-deno-version.ts");
  const versionCheckValid =
    existsSync(versionPath) &&
    readFileSync(versionPath, "utf8") === renderDenoVersionCheck();
  checks.push({
    name: "deno-version",
    status: versionCheckValid ? "pass" : "fail",
    message: versionCheckValid
      ? "Deno 2.9.5 is pinned"
      : "Deno 2.9.5 version check is missing or differs",
    fixable: true,
  });
  const packagePath = path.join(repoRoot, "package.json");
  if (existsSync(packagePath)) {
    const scripts = (readJson(packagePath).scripts ?? {}) as Record<
      string,
      string
    >;
    const missing = Object.entries(PACKAGE_SCRIPT_ALIASES).filter(
      ([name, expected]) => scripts[name] !== expected,
    );
    checks.push({
      name: "scripts",
      status: missing.length ? "warn" : "pass",
      message: missing.length
        ? `script aliases differ: ${missing.map(([name]) => name).join(", ")}`
        : "package.json has the exact spec-validator aliases",
      fixable: true,
    });
  }
  const skillPath = globalSkillPath();
  const skillPresent = existsSync(skillPath);
  checks.push({
    name: "skill",
    status: skillPresent ? "pass" : "warn",
    message: skillPresent
      ? `skill installed at ${skillPath}`
      : `skill not installed at ${path.join(
          os.homedir(),
          ".agents/skills/spec-validator/SKILL.md",
        )}${skillRequested ? "" : "; pass --skill to request installation"}`,
    fixable: skillRequested,
  });
  return { checks, config };
}

function applyRepairs(
  repoRoot: string,
  config: ResolvedConfig,
  skillRequested: boolean,
): string[] {
  const repairs: string[] = [];
  const bookPath = path.join(repoRoot, "spec/book.toml");
  if (config.validators.book && !existsSync(bookPath)) {
    mkdirSync(path.dirname(bookPath), { recursive: true });
    writeFileSync(
      bookPath,
      `[book]\ntitle = "Specification"\nlanguage = "en"\nsrc = "${config.validators.book.src}"\n\n[build]\nbuild-dir = "${config.validators.book.buildDir}"\n`,
    );
    repairs.push("spec/book.toml");
  }
  if (appendIgnore(repoRoot, "spec/book/")) repairs.push(".gitignore");
  const denoPath = path.join(repoRoot, "deno.json");
  const denoConfig = existsSync(denoPath) ? readJson(denoPath) : {};
  const currentDenoTasks = (denoConfig.tasks ?? {}) as Record<string, string>;
  if (
    Object.entries(DENO_TASKS).some(
      ([name, command]) => currentDenoTasks[name] !== command,
    )
  ) {
    denoConfig.tasks = { ...currentDenoTasks, ...DENO_TASKS };
    writeFileSync(denoPath, `${JSON.stringify(denoConfig, null, 2)}\n`);
    repairs.push("deno.json");
  }
  const versionPath = path.join(repoRoot, "scripts/check-deno-version.ts");
  if (
    !existsSync(versionPath) ||
    readFileSync(versionPath, "utf8") !== renderDenoVersionCheck()
  ) {
    mkdirSync(path.dirname(versionPath), { recursive: true });
    writeFileSync(versionPath, renderDenoVersionCheck());
    repairs.push("scripts/check-deno-version.ts");
  }
  if (config.validators.qmd) {
    const qmdPath = path.join(repoRoot, config.validators.qmd.configPath);
    const source = existsSync(qmdPath) ? readFileSync(qmdPath, "utf8") : "";
    const valid =
      source.includes(config.validators.qmd.collection) &&
      /path:\s*spec\/src/.test(source) &&
      /pattern:\s*["']?\*\*\/\*\.md/.test(source);
    if (!valid) {
      mkdirSync(path.dirname(qmdPath), { recursive: true });
      writeFileSync(
        qmdPath,
        `collections:\n  ${config.validators.qmd.collection}:\n    path: spec/src\n    pattern: "**/*.md"\n`,
      );
      repairs.push(config.validators.qmd.configPath);
    }
    if (appendIgnore(repoRoot, ".qmd/index.sqlite*")) {
      repairs.push(".gitignore");
    }
  }
  const packagePath = path.join(repoRoot, "package.json");
  if (existsSync(packagePath)) {
    const manifest = readJson(packagePath) as {
      scripts?: Record<string, string>;
    };
    const currentScripts = manifest.scripts ?? {};
    const needsRepair = Object.entries(PACKAGE_SCRIPT_ALIASES).some(
      ([name, script]) => currentScripts[name] !== script,
    );
    if (needsRepair) {
      manifest.scripts = { ...currentScripts, ...PACKAGE_SCRIPT_ALIASES };
      writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
      repairs.push("package.json");
    }
  }
  if (skillRequested && !existsSync(globalSkillPath())) {
    repairs.push(installSkill());
  }
  return [...new Set(repairs)];
}

export async function doctorCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  assertCommandArgs(argv, {
    boolean: ["--fix", "--strict", "--skill"],
  });
  const fix = hasFlag(argv, "--fix");
  const strict = hasFlag(argv, "--strict");
  const skillRequested = hasFlag(argv, "--skill");
  let inspection = await inspect(repoRoot, skillRequested);
  let repairs: string[] = [];
  if (fix && inspection.config) {
    repairs = applyRepairs(repoRoot, inspection.config, skillRequested);
    inspection = await inspect(repoRoot, skillRequested);
  }
  if (repairs.length) {
    inspection.checks.push({
      name: "repairs",
      status: "pass",
      message: `applied ${repairs.join(", ")}`,
    });
  }
  const failed = inspection.checks.some((check) => check.status === "fail");
  const warned = inspection.checks.some((check) => check.status === "warn");
  const ok = !failed && (!strict || !warned);
  reporter.writeReport({
    version: 1,
    ok,
    exitCode: ok ? 0 : 1,
    checks: inspection.checks,
  });
  return ok ? 0 : 1;
}
