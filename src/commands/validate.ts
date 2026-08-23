import { loadResolvedConfig, resolveDiagnosticRule } from "../config.js";
import { createValidationContext } from "../context.js";
import { compareDiagnostics, diagnostic } from "../diagnostics.js";
import { path, pathToFileURL } from "../platform/current.js";
import type { Reporter } from "../reporter.js";
import type { Diagnostic, ResolvedConfig, Validator } from "../types.js";
import {
  assertKnownValidatorNames,
  BUILTIN_VALIDATOR_NAMES,
  enabledValidators,
} from "../validators/index.js";
import { assertCommandArgs, readList, UsageError } from "../argv.js";

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
  assertCommandArgs(argv, { value: ["--only", "--skip"] });
  const config = await loadResolvedConfig(repoRoot);
  const only = readList(argv, "--only");
  const skip = readList(argv, "--skip");
  const plugins = await loadPlugins(repoRoot, config);
  const available = [
    ...BUILTIN_VALIDATOR_NAMES,
    ...plugins.map((plugin) => plugin.name),
  ];
  assertKnownValidatorNames(only, available);
  assertKnownValidatorNames(skip, available);
  const builtins = enabledValidators(config, {
    only,
    skip,
    exclude: ["specFirst"],
  });
  const selectedPlugins = plugins.filter((plugin) => {
    if (only?.length && !only.includes(plugin.name)) return false;
    return !skip?.includes(plugin.name);
  });
  const validators = [...builtins, ...selectedPlugins];
  const context = createValidationContext({ repoRoot, config });
  const findings = [
    ...builtins.flatMap((validator) =>
      validator.validate(context).map((finding) => ({
        ...finding,
        rule: resolveDiagnosticRule(config, validator.name, finding.code),
      })),
    ),
    ...selectedPlugins.flatMap((validator) => validator.validate(context)),
  ].sort(compareDiagnostics);
  return {
    ok: findings.length === 0,
    findings,
    stats: {
      validators: validators.length,
      chapters: context.model.files.filter(
        (file) => file.chapterPath !== "SUMMARY.md",
      ).length,
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
    if (error instanceof UsageError) throw error;
    const finding = diagnostic({
      code: "SPEC-INTERNAL",
      rule: "SPEC-CONFIG",
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
