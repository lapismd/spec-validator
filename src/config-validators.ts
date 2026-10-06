import type { ValidatorOptions, ResolvedValidators } from "./types.js";
function resolveValidator<K extends keyof ResolvedValidators>(
  value: ValidatorOptions[K],
  defaults: Exclude<ResolvedValidators[K], false>,
): ResolvedValidators[K] {
  if (value === undefined || value === false) return false;
  return (
    value === true ? defaults : { ...defaults, ...(value as object) }
  ) as ResolvedValidators[K];
}
export function resolveValidators(input: ValidatorOptions): ResolvedValidators {
  const validators: ResolvedValidators = {
    summary: resolveValidator<"summary">(input.summary, { fragments: false }),
    fileLimits: resolveValidator<"fileLimits">(input.fileLimits, {
      maxLines: 400,
      maxBytes: 32768,
    }),
    governance: resolveValidator<"governance">(input.governance, {
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
    verification: resolveValidator<"verification">(input.verification, {
      mode: "table" as const,
      file: "verification.md",
      files: [],
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
    book: resolveValidator<"book">(input.book, {
      src: "src",
      buildDir: "book",
    }),
    publicSurfaces: resolveValidator<"publicSurfaces">(input.publicSurfaces, {
      map: "spec/public-surfaces.json",
      roots: ["src"],
      requireCoverage: true,
    }),
    storybookCatalog: resolveValidator<"storybookCatalog">(
      input.storybookCatalog,
      {
        roots: ["src"],
        packageRoots: [],
        storyOnlyName:
          "(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?)$",
        forbiddenSource:
          "\\b(?:[A-Z][A-Za-z0-9]*(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?))\\b|\\bargs\\s*\\.",
        plainTextLanguages: ["html", "markup", "svelte"],
      },
    ),
    storybookMirrors: resolveValidator<"storybookMirrors">(
      input.storybookMirrors,
      {
        style: "src-spec-mdx" as const,
        directory: "src/spec",
        titlePrefix: "Specification",
        verifyTarget: true,
        verifyTitle: false,
        verifyContent: false,
        previewPath: ".storybook/preview.ts",
        verifyOrder: false,
        registryEntryTemplate: 'source: "<chapter>"',
      },
    ),
    repositoryLayout: resolveValidator<"repositoryLayout">(
      input.repositoryLayout,
      {
        requiredFiles: [],
        forbiddenEntries: [],
        forbiddenPaths: [],
        allowedRootMarkdown: [],
      },
    ),
    packageDocs: resolveValidator<"packageDocs">(input.packageDocs, {
      root: "packages",
      packagePattern: "^(?:[^-]+-)?plugin-(.+)$",
      chapterTemplate: "plugins/<name>.md",
      identityTemplate: "<name>",
    }),
    qmd: resolveValidator<"qmd">(input.qmd, {
      collection: "spec",
      defaultScope: "",
      scopes: {},
      configPath: ".qmd/index.yml",
    }),
    markdownlint: resolveValidator<"markdownlint">(input.markdownlint, {
      config: ".markdownlint-cli2.jsonc",
    }),
    packageManifest: resolveValidator<"packageManifest">(
      input.packageManifest,
      {
        privateAllowed: true,
        portableDependencies: false,
        manifestPath: "manifest.json",
      },
    ),
    specFirst: resolveValidator<"specFirst">(input.specFirst, {
      mode: "mapped" as const,
      canonicalPattern: "^spec/src/(?!SUMMARY\\.md$).+\\.md$",
      ignore: [],
      rules: [],
      protected: [],
      conditional: {},
    }),
  };
  return validators;
}
