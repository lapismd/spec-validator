import {
  defineConfig,
  headingRequirements,
  singleIdVerification,
} from "./dist/index.js";

export default defineConfig(headingRequirements(), {
  name: "spec-validator",
  idPattern: /^SV-[A-Z]+-\d{3}$/,
  ruleIds: {
    summary: "SV-GOV-003",
    governance: "SV-GOV-001",
    verification: "SV-GOV-002",
    book: "SV-GOV-003",
    bookIgnore: "SV-GOV-005",
    qmd: "SV-QMD-001",
    markdownlint: "SV-CLI-003",
    specFirst: "SV-GOV-004",
    internal: "SV-GOV-003",
  },
  diagnostics: {
    "SPEC-BOOK-IGNORE": "SV-GOV-005",
    "SPEC-BOOK-TRACKED": "SV-GOV-005",
  },
  validators: {
    summary: true,
    governance: { extras: ["AGENTS.md", "README.md"] },
    verification: singleIdVerification(),
    book: true,
    qmd: { collection: "spec-validator" },
    markdownlint: { config: ".markdownlint-cli2.jsonc" },
    specFirst: {
      mode: "mapped",
      ignore: [
        "(^|/)node_modules/",
        "(^|/)(?:dist|build|coverage)/",
        "^spec/book/",
        "\\.(?:spec|test)\\.[cm]?[jt]sx?$",
      ],
      rules: [
        {
          pattern: "^src/(?:cli|argv|color|reporter)\\.ts$",
          chapters: ["spec/src/cli.md"],
        },
        { pattern: "^src/index\\.ts$", chapters: ["spec/src/architecture.md"] },
        {
          pattern: "^src/commands/(?:validate|check|list|build|first)\\.ts$",
          chapters: ["spec/src/cli.md"],
        },
        {
          pattern: "^src/(?:config|profiles|presets)\\.ts$",
          chapters: ["spec/src/configuration.md"],
        },
        {
          pattern: "^spec-validator\\.config\\.(?:ts|mjs|json)$",
          chapters: ["spec/src/configuration.md"],
        },
        { pattern: "^src/validators/", chapters: ["spec/src/validators.md"] },
        {
          pattern:
            "^src/(?:model|tracked-files|types|diagnostics|context)\\.ts$",
          chapters: ["spec/src/architecture.md"],
        },
        {
          pattern: "^src/commands/(?:doctor|init)\\.ts$",
          chapters: ["spec/src/doctor-and-init.md"],
        },
        {
          pattern: "^src/commands/search\\.ts$",
          chapters: ["spec/src/search-and-qmd.md"],
        },
        {
          pattern: "^src/commands/skill\\.ts$",
          chapters: ["spec/src/skill-and-agents.md"],
        },
        { pattern: "^scripts/", chapters: ["spec/src/architecture.md"] },
        { pattern: "^skill/", chapters: ["spec/src/skill-and-agents.md"] },
        {
          pattern:
            "^(?:spec/book\\.toml|\\.qmd/index\\.ya?ml|\\.gitignore|AGENTS\\.md)$",
          chapters: ["spec/src/spec-governance.md"],
        },
        {
          pattern:
            "^(?:package\\.json|pnpm-lock\\.yaml|pnpm-workspace\\.yaml)$",
          chapters: ["spec/src/architecture.md"],
        },
      ],
      protected: [
        "^src/",
        "^spec-validator\\.config\\.(?:ts|mjs|json)$",
        "^skill/",
        "^scripts/",
        "^spec/book\\.toml$",
        "^(?:package\\.json|pnpm-lock\\.yaml|pnpm-workspace\\.yaml)$",
        "^AGENTS\\.md$",
      ],
    },
  },
  check: {
    lanes: [{ name: "tests", command: "pnpm", args: ["test"] }],
    build: true,
    first: true,
  },
});
