# Validators

Built-in validators are named modules. Each can be enabled, configured, or replaced by a consumer plugin.

## Public surface coverage

| Surface | Public boundary | Requirement |
| --- | --- | --- |
| Built-in catalog | Validators | SV-VAL-001 |
| Extension contract | Validators | SV-VAL-002 |

## SV-VAL-001 — Built-in catalog

**Requirement.** The package MUST ship `summary`, `governance`, `verification`, `book`, `publicSurfaces`, `storybookCatalog`, `storybookMirrors`, `qmd`, `markdownlint`, `packageManifest`, and `specFirst` as named built-in validators.

### Acceptance details

- `summary` MUST check `SUMMARY.md` coverage and local Markdown links.
- `governance` MUST check requirement structure, uniqueness, and unknown references.
- `verification` MUST check one row per ID, allowed statuses, and evidence.
- `book` MUST check `spec/book.toml` and untracked `spec/book/` output.

## SV-VAL-002 — Extension contract

**Requirement.** A validator MUST be a module with a stable `name` and a `validate(context)` function, and optional validators MUST stay inert when disabled.

### Acceptance details

- `publicSurfaces`, `storybookCatalog`, `storybookMirrors`, `qmd`, `markdownlint`, and `packageManifest` MUST run only when enabled.
- `specFirst` MUST classify path-to-chapter maps from config rather than hard-coded foreign trees.
- Requirement ID and heading or table style MUST come from resolved config.
- `list` MUST report each validator’s enabled state and options.
