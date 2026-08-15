# Validators

Built-in validators are named modules. Each can be enabled, configured, or replaced by a consumer plugin.

## Public surface coverage

| Surface                | Public boundary | Requirement |
| ---------------------- | --------------- | ----------- |
| Built-in catalog       | Validators      | SV-VAL-001  |
| Extension contract     | Validators      | SV-VAL-002  |
| Reusable configuration | Validators      | SV-VAL-003  |

## SV-VAL-001 — Built-in catalog

**Requirement.** The package MUST ship `summary`, `governance`, `verification`, `book`, `publicSurfaces`, `storybookCatalog`, `storybookMirrors`, `repositoryLayout`, `packageDocs`, `qmd`, `markdownlint`, `packageManifest`, and `specFirst` as named built-in validators.

### Acceptance details

- `summary` MUST check `SUMMARY.md` coverage and local Markdown links.
- `governance` MUST check requirement structure, uniqueness, unknown references, strict configured table sections, and optional declared acceptance details.
- `verification` MUST check one row per ID, allowed statuses, and evidence.
- `book` MUST check `spec/book.toml` and untracked `spec/book/` output, while `repositoryLayout` MUST reject configured tracked patterns and exact filesystem entries and `packageDocs` MUST express reusable package coverage without repository names.

## SV-VAL-002 — Extension contract

**Requirement.** A validator MUST be a module with a stable `name` and a `validate(context)` function, and optional validators MUST stay inert when disabled.

### Acceptance details

- `publicSurfaces`, `storybookCatalog`, `storybookMirrors`, `qmd`, `markdownlint`, and `packageManifest` MUST run only when enabled.
- `specFirst` MUST classify path-to-chapter maps from config rather than hard-coded foreign trees.
- Requirement ID and heading or table style MUST come from resolved config.
- `list` MUST report each validator’s enabled state and options.

## SV-VAL-003 — Reusable configuration

**Requirement.** Core validators MUST expose declarative options for the validation patterns shared by the target repositories so consumers do not need to reimplement Markdown, TypeScript, Svelte, Storybook, manifest, or VCS parsing.

### Acceptance details

- Verification MUST support configured sections and headers, single or grouped IDs, exact-one or at-least-one row multiplicity, reference-only traceability, and exact or prefix statuses; table governance MUST support strict configured sections and configurable declared acceptance details outside fenced examples.
- Storybook catalog validation MUST support local helpers, raw examples, Svelte module scripts and markup parameters, package story discovery, and configurable boundary and language rules.
- Storybook mirrors MUST support target, title, metadata-only content, order, and registry coverage checks when enabled.
- Spec-first MUST support ordered path mappings, capture maps, ignored paths, conditional changed-line protection, and mapped-chapter or any-canonical modes.
