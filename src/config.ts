import { createJiti } from "jiti";

import { existsSync, path, readFileSync } from "./platform/current.js";
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
  "spec-validator.config.json",
] as const;

const VALIDATOR_NAMES = [
  "summary",
  "governance",
  "verification",
  "book",
  "publicSurfaces",
  "storybookCatalog",
  "storybookMirrors",
  "repositoryLayout",
  "packageDocs",
  "qmd",
  "markdownlint",
  "packageManifest",
  "specFirst",
] as const satisfies ReadonlyArray<keyof ResolvedValidators>;

const EMPTY_RULE_IDS: RuleIds = {
  summary: "",
  governance: "",
  verification: "",
  book: "",
  bookIgnore: "",
  publicSurfaces: "",
  storybookCatalog: "",
  storybookMirrors: "",
  repositoryLayout: "",
  packageDocs: "",
  qmd: "",
  markdownlint: "",
  packageManifest: "",
  specFirst: "",
  internal: "",
};

function mergeFragments(fragments: UserConfig[]): UserConfig {
  return fragments.reduce<UserConfig>(
    (result, fragment) => ({
      ...result,
      ...fragment,
      ruleIds: { ...result.ruleIds, ...fragment.ruleIds },
      diagnostics: { ...result.diagnostics, ...fragment.diagnostics },
      validators: { ...result.validators, ...fragment.validators },
      check:
        fragment.check === undefined ? result.check : { ...fragment.check },
    }),
    {},
  );
}

export function defineConfig(
  first: UserConfig,
  ...fragments: UserConfig[]
): UserConfig {
  return mergeFragments([first, ...fragments]);
}

export function mergeValidatorOptions<T extends object>(
  base: T,
  override: Partial<T>,
): T {
  return { ...base, ...override };
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
    return JSON.parse(readFileSync(configPath, "utf8")) as UserConfig;
  }
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loaded = await jiti.import(configPath);
  const config =
    loaded && typeof loaded === "object" && "default" in loaded
      ? (loaded as { default: UserConfig }).default
      : (loaded as UserConfig);
  if (!config || typeof config !== "object") {
    throw new Error(
      `${path.basename(configPath)} did not export a config object`,
    );
  }
  return config;
}

function asRegExp(
  value: string | RegExp | undefined,
  fallback: RegExp,
): RegExp {
  if (!value) return fallback;
  if (value instanceof RegExp) return value;
  const match = /^\/(.+)\/([a-z]*)$/.exec(value);
  return match ? new RegExp(match[1]!, match[2]) : new RegExp(value);
}

function resolveValidator<T extends object>(
  value: boolean | object | undefined,
  defaults: T,
): T | false {
  if (value === false || value === undefined) return false;
  if (value === true) return { ...defaults };
  return { ...defaults, ...value } as T;
}

function diagnosticMappingExists(
  diagnostics: Record<string, string>,
  validator: string,
): boolean {
  return Boolean(
    diagnostics[`${validator}:*`] ||
    diagnostics["*"] ||
    Object.keys(diagnostics).some(
      (key) => key.startsWith("SPEC-") && key.endsWith("*"),
    ),
  );
}

function validateRuleMappings(config: ResolvedConfig): void {
  for (const validator of VALIDATOR_NAMES) {
    if (config.validators[validator] === false) continue;
    if (
      config.ruleIds[validator] ||
      diagnosticMappingExists(config.diagnostics, validator)
    ) {
      continue;
    }
    throw new Error(
      `enabled validator ${validator} needs ruleIds.${validator} or diagnostics["${validator}:*"]`,
    );
  }
  if (
    !config.ruleIds.internal &&
    !config.diagnostics["internal:*"] &&
    !config.diagnostics["SPEC-INTERNAL"]
  ) {
    throw new Error(
      'configuration needs ruleIds.internal or diagnostics["SPEC-INTERNAL"]',
    );
  }
  if (config.validators.book !== false && !config.ruleIds.bookIgnore) {
    const mapped =
      config.diagnostics["SPEC-BOOK-IGNORE"] ||
      config.diagnostics["SPEC-BOOK-TRACKED"];
    if (!mapped) {
      throw new Error(
        "book validation needs ruleIds.bookIgnore or exact ignore/tracked diagnostic mappings",
      );
    }
  }
}

export function resolveDiagnosticRule(
  config: ResolvedConfig,
  validator: keyof RuleIds | string,
  code: string,
): string {
  const exact = config.diagnostics[code];
  if (exact) return exact;
  const wildcard = Object.entries(config.diagnostics)
    .filter(([key]) => key.endsWith("*") && code.startsWith(key.slice(0, -1)))
    .sort(([left], [right]) => right.length - left.length)[0]?.[1];
  if (wildcard) return wildcard;
  const validatorDefault = config.diagnostics[`${validator}:*`];
  if (validatorDefault) return validatorDefault;
  const globalDefault = config.diagnostics["*"];
  if (globalDefault) return globalDefault;
  const legacyDefault = config.ruleIds[validator as keyof RuleIds];
  if (legacyDefault) return legacyDefault;
  throw new Error(
    `diagnostic ${code} from ${validator} has no governing rule mapping`,
  );
}

export function resolveConfig(user: UserConfig): ResolvedConfig {
  const idPattern = asRegExp(user.idPattern, /^SV-[A-Z]+-\d{3}$/);
  const source = idPattern.source;
  const inner =
    source.startsWith("^") && source.endsWith("$")
      ? source.slice(1, -1)
      : source;
  const referencePattern = asRegExp(
    user.referencePattern,
    new RegExp(`\\b(?:${inner})\\b`, "g"),
  );
  const input = user.validators ?? ({} as ValidatorOptions);

  const validators: ResolvedValidators = {
    summary: resolveValidator(input.summary, {}),
    governance: resolveValidator(input.governance, {
      extras: [],
      normative: true,
      proseLimits: true,
      acceptance: true,
      acceptanceScope: "all" as const,
      acceptanceIntroduction: "forbid" as const,
      acceptanceAtomic: true,
      acceptanceColocation: true,
      references: true,
      changeMap: true,
    }),
    verification: resolveValidator(input.verification, {
      mode: "table" as const,
      file: "verification.md",
      headers: {
        ids: ["Requirement", "Requirements", "ID"],
        status: ["Status", "Audit state"],
        evidence: ["Evidence", "Primary automated evidence"],
        required: [],
      },
      idMode: "single" as const,
      statuses: ["Implemented", "In progress", "Partial"],
      statusMatch: "exact" as const,
      rowMultiplicity: "exactly-one" as const,
      rejectOrphans: true,
      requireEvidence: true,
    }),
    book: resolveValidator(input.book, { src: "src", buildDir: "book" }),
    publicSurfaces: resolveValidator(input.publicSurfaces, {
      map: "spec/public-surfaces.json",
      roots: ["src"],
      requireCoverage: true,
    }),
    storybookCatalog: resolveValidator(input.storybookCatalog, {
      roots: ["src"],
      packageRoots: [],
      storyOnlyName:
        "(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?)$",
      forbiddenSource:
        "\\b(?:[A-Z][A-Za-z0-9]*(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?))\\b|\\bargs\\s*\\.",
      plainTextLanguages: ["html", "markup", "svelte"],
    }),
    storybookMirrors: resolveValidator(input.storybookMirrors, {
      style: "src-spec-mdx" as const,
      directory: "src/spec",
      titlePrefix: "Specification",
      verifyTarget: true,
      verifyTitle: false,
      verifyContent: false,
      previewPath: ".storybook/preview.ts",
      verifyOrder: false,
      registryEntryTemplate: 'source: "<chapter>"',
    }),
    repositoryLayout: resolveValidator(input.repositoryLayout, {
      requiredFiles: [],
      forbiddenEntries: [],
      forbiddenPaths: [],
      allowedRootMarkdown: [],
    }),
    packageDocs: resolveValidator(input.packageDocs, {
      root: "packages",
      packagePattern: "^(?:[^-]+-)?plugin-(.+)$",
      chapterTemplate: "plugins/<name>.md",
      identityTemplate: "<name>",
    }),
    qmd: resolveValidator(input.qmd, {
      collection: "spec",
      configPath: ".qmd/index.yml",
    }),
    markdownlint: resolveValidator(input.markdownlint, {
      config: ".markdownlint-cli2.jsonc",
    }),
    packageManifest: resolveValidator(input.packageManifest, {
      privateAllowed: true,
      portableDependencies: false,
      manifestPath: "manifest.json",
    }),
    specFirst: resolveValidator(input.specFirst, {
      mode: "mapped" as const,
      canonicalPattern: "^spec/src/(?!SUMMARY\\.md$).+\\.md$",
      ignore: [],
      rules: [],
      protected: [],
      conditional: {},
    }),
  };

  const config: ResolvedConfig = {
    name: user.name ?? "custom",
    idPattern,
    referencePattern,
    specDir: user.specDir ?? "spec/src",
    requirementStyle: user.requirementStyle ?? "heading",
    tableSection: user.tableSection ?? null,
    headingTemplate: user.headingTemplate ?? "## <ID> — <surface>",
    maxWords: user.maxWords ?? 80,
    maxSentences: user.maxSentences ?? 4,
    minAcceptance: user.minAcceptance ?? 2,
    maxAcceptance: user.maxAcceptance === undefined ? 4 : user.maxAcceptance,
    ruleIds: { ...EMPTY_RULE_IDS, ...user.ruleIds },
    diagnostics: { ...user.diagnostics },
    validators,
    plugins: user.plugins ?? [],
    check: {
      lanes: user.check?.lanes ?? [],
      build: user.check?.build ?? true,
      first: user.check?.first ?? true,
    },
  };
  validateRuleMappings(config);
  return config;
}

export async function loadResolvedConfig(
  repoRoot: string,
): Promise<ResolvedConfig> {
  return resolveConfig(await loadUserConfig(repoRoot));
}
