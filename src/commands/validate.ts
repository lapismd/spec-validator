import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadResolvedConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { compareDiagnostics, diagnostic } from "../diagnostics.js";
import type { Reporter } from "../reporter.js";
import type { Diagnostic, ResolvedConfig, Validator } from "../types.js";
import { enabledValidators } from "../validators/index.js";
import { readList } from "../argv.js";

export async function loadPlugins(
  repoRoot: string,
  config: ResolvedConfig,
): Promise<Validator[]> {
  const plugins: Validator[] = [];
  for (const specifier of config.plugins) {
    const absolute = path.resolve(repoRoot, specifier);
    const loaded = (await import(pathToFileURL(absolute).href)) as {
      default?: Validator;
      name?: string;
      validate?: Validator["validate"];
    };
    const validator = loaded.default ?? loaded;
    if (!validator.name || typeof validator.validate !== "function") {
      throw new Error(`plugin ${specifier} must export name and validate()`);
    }
    plugins.push(validator as Validator);
  }
  return plugins;
}

export async function runValidation(
  repoRoot: string,
  argv: string[] = [],
): Promise<{
  ok: boolean;
  findings: Diagnostic[];
  stats: { validators: number; chapters: number; requirements: number };
}> {
  const config = await loadResolvedConfig(repoRoot);
  const only = readList(argv, "--only");
  const skip = readList(argv, "--skip");
  const validators = [
    ...enabledValidators(config, { only, skip, exclude: ["specFirst"] }),
    ...(only ? [] : await loadPlugins(repoRoot, config)),
  ];
  const context = createValidationContext({ repoRoot, config });
  const findings = validators
    .flatMap((validator) => validator.validate(context))
    .sort(compareDiagnostics);
  return {
    ok: findings.length === 0,
    findings,
    stats: {
      validators: validators.length,
      chapters: context.model.files.filter((file) => file.chapterPath !== "SUMMARY.md")
        .length,
      requirements: context.model.definitions.length,
    },
  };
}

export async function validateCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  try {
    const result = await runValidation(repoRoot, argv);
    reporter.writeReport({
      version: 1,
      ok: result.ok,
      exitCode: result.ok ? 0 : 1,
      findings: result.findings,
      stats: result.stats,
    });
    return result.ok ? 0 : 1;
  } catch (error) {
    const finding = diagnostic({
      code: "SPEC-INTERNAL",
      rule: "SV-GOV-003",
      file: "spec-validator",
      message: error instanceof Error ? error.message : String(error),
    });
    reporter.writeReport({
      version: 1,
      ok: false,
      exitCode: 2,
      findings: [finding],
    });
    return 2;
  }
}
