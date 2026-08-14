import { existsSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

import { getPreset } from "./presets.js";
import type {
  ResolvedConfig,
  ResolvedValidators,
  RuleIds,
  UserConfig,
  ValidatorOptions,
} from "./types.js";

export const CONFIG_FILES = [
  "spec-validator.config.ts",
  "spec-validator.config.mjs",
  "spec-validator.config.js",
  "spec-validator.config.json",
] as const;

const DEFAULT_RULE_IDS: RuleIds = {
  summary: "SV-GOV-003",
  governance: "SV-GOV-001",
  verification: "SV-GOV-002",
  book: "SV-GOV-003",
  bookIgnore: "SV-GOV-005",
  publicSurfaces: "SV-GOV-003",
  storybookCatalog: "SV-VAL-001",
  storybookMirrors: "SV-VAL-001",
  qmd: "SV-QMD-001",
  markdownlint: "SV-CLI-003",
  packageManifest: "SV-ARCH-001",
  specFirst: "SV-GOV-004",
  internal: "SV-GOV-003",
};

export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

export function findConfigPath(repoRoot: string): string | null {
  for (const file of CONFIG_FILES) {
    const absolute = path.join(repoRoot, file);
    if (existsSync(absolute)) return absolute;
  }
  return null;
}

export async function loadUserConfig(repoRoot: string): Promise<UserConfig> {
  const configPath = findConfigPath(repoRoot);
  if (!configPath) {
    throw new Error(
      "missing spec-validator.config.ts, .mjs, or .json; run spec-validator init",
    );
  }
  if (configPath.endsWith(".json")) {
    const { readFileSync } = await import("node:fs");
    return JSON.parse(readFileSync(configPath, "utf8")) as UserConfig;
  }
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loaded = await jiti.import(configPath);
  const config =
    loaded && typeof loaded === "object" && "default" in loaded
      ? (loaded as { default: UserConfig }).default
      : (loaded as UserConfig);
  if (!config || typeof config !== "object") {
    throw new Error(`${path.basename(configPath)} did not export a config object`);
  }
  return config;
}

function asRegExp(value: string | RegExp | undefined, fallback: RegExp): RegExp {
  if (!value) return fallback;
  if (value instanceof RegExp) return value;
  const match = /^\/(.+)\/([a-z]*)$/.exec(value);
  return match ? new RegExp(match[1]!, match[2]) : new RegExp(value);
}

function mergeValidator<T extends object>(
  preset: unknown,
  override: unknown,
  fallback: T | false,
): T | false {
  if (override === false) return false;
  if (override === undefined) {
    if (preset === false || preset === undefined) return false;
    if (preset === true) return { ...fallback } as T;
    return { ...(fallback as T), ...(preset as T) };
  }
  if (override === true) {
    if (preset && preset !== true) return { ...(fallback as T), ...(preset as T) };
    return { ...fallback } as T;
  }
  const base =
    preset && preset !== true && preset !== false
      ? { ...(fallback as T), ...(preset as T) }
      : { ...fallback } as T;
  return { ...base, ...(override as T) };
}

export function resolveConfig(user: UserConfig): ResolvedConfig {
  const preset = user.preset ? getPreset(user.preset) : {};
  const merged: UserConfig = {
    ...preset,
    ...user,
    ruleIds: { ...preset.ruleIds, ...user.ruleIds },
    validators: { ...preset.validators, ...user.validators },
    check: { ...preset.check, ...user.check },
  };
  const idPattern = asRegExp(merged.idPattern, /^SV-[A-Z]+-\d{3}$/);
  const source = idPattern.source;
  const inner = source.startsWith("^") && source.endsWith("$")
    ? source.slice(1, -1)
    : source;
  const validatorsIn = {
    ...preset.validators,
    ...user.validators,
  } as ValidatorOptions;

  const validators: ResolvedValidators = {
    summary: mergeValidator(preset.validators?.summary, validatorsIn.summary, {}),
    governance: mergeValidator(preset.validators?.governance, validatorsIn.governance, {
      extras: [],
    }),
    verification: mergeValidator(
      preset.validators?.verification,
      validatorsIn.verification,
      {
        columns: 3,
        statuses: ["Implemented", "In progress", "Partial"],
        header: "Requirement",
      },
    ),
    book: mergeValidator(preset.validators?.book, validatorsIn.book, {
      src: "src",
      buildDir: "book",
    }),
    publicSurfaces: mergeValidator(
      preset.validators?.publicSurfaces,
      validatorsIn.publicSurfaces,
      { map: "spec/public-surfaces.json" },
    ),
    storybookCatalog: mergeValidator(
      preset.validators?.storybookCatalog,
      validatorsIn.storybookCatalog,
      { roots: ["src"] },
    ),
    storybookMirrors: mergeValidator(
      preset.validators?.storybookMirrors,
      validatorsIn.storybookMirrors,
      { style: "src-spec-mdx" as const, directory: "src/spec" },
    ),
    qmd: mergeValidator(preset.validators?.qmd, validatorsIn.qmd, {
      collection: "spec-validator",
      configPath: ".qmd/index.yml",
    }),
    markdownlint: mergeValidator(
      preset.validators?.markdownlint,
      validatorsIn.markdownlint,
      { config: ".markdownlint-cli2.jsonc" },
    ),
    packageManifest: mergeValidator(
      preset.validators?.packageManifest,
      validatorsIn.packageManifest,
      {
        privateAllowed: true,
        portableDependencies: false,
        manifestPath: "manifest.json",
      },
    ),
    specFirst: mergeValidator(preset.validators?.specFirst, validatorsIn.specFirst, {
      changeMap: "spec/src/spec-governance.md",
      ignore: [],
      rules: [],
      protected: [],
    }),
  };

  return {
    preset: merged.preset ?? "custom",
    idPattern,
    referencePattern: new RegExp(`\\b(?:${inner})\\b`, "g"),
    specDir: merged.specDir ?? "spec/src",
    requirementStyle: merged.requirementStyle ?? "heading",
    headingTemplate: merged.headingTemplate ?? "## <ID> — <surface>",
    maxWords: merged.maxWords ?? 80,
    maxSentences: merged.maxSentences ?? 4,
    minAcceptance: merged.minAcceptance ?? 2,
    maxAcceptance: merged.maxAcceptance ?? 4,
    ruleIds: { ...DEFAULT_RULE_IDS, ...merged.ruleIds },
    validators,
    plugins: merged.plugins ?? [],
    check: merged.check ?? {},
  };
}

export async function loadResolvedConfig(repoRoot: string): Promise<ResolvedConfig> {
  return resolveConfig(await loadUserConfig(repoRoot));
}
