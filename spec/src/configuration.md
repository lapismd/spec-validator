# Configuration

Consumers configure the CLI with `spec-validator.config.ts`, `.mjs`, or `.json` at the repository root.

## Public surface coverage

| Surface                     | Public boundary | Requirement |
| --------------------------- | --------------- | ----------- |
| Config files and profiles   | Configuration   | SV-CFG-001  |
| Validator enablement        | Configuration   | SV-CFG-002  |
| Consumer rule IDs           | Configuration   | SV-CFG-003  |
| Repository policy ownership | Configuration   | SV-CFG-004  |

## SV-CFG-001 — Config files and profiles

**Requirement.** The loader MUST read the first existing `spec-validator.config.ts`, `.mjs`, or `.json` from the consumer root and MUST resolve typed consumer configuration with optional neutral profiles.

### Acceptance details

- `defineConfig` MUST be the supported TypeScript helper.
- A missing config MUST fail `validate`, `check`, and `doctor` unless `init` is creating one.
- Profiles MUST describe reusable document or source shapes and MUST NOT be named for a consumer repository.
- Later configuration fragments MUST replace earlier validator options unless an explicit merge helper is used.

## SV-CFG-002 — Validator enablement

**Requirement.** Built-in validators MUST stay off unless an explicit config or neutral profile enables them, and `false` MUST disable an earlier profile validator.

### Acceptance details

- An options object MUST replace earlier options for that validator.
- CLI `--only` MUST run only the named validators for that invocation.
- CLI `--skip` MUST disable the named validators for that invocation.
- `plugins` MUST load additional `{ name, validate }` modules from the consumer root.

## SV-CFG-003 — Consumer rule IDs

**Requirement.** Diagnostic `rule` fields MUST use consumer-owned requirement IDs supplied by configuration, with exact diagnostic-code overrides available over validator defaults.

### Acceptance details

- Every enabled built-in MUST have a validator default or mappings for all emitted diagnostic codes.
- Exact diagnostic mappings MUST override validator defaults so one validator may report findings governed by different requirements, and a custom reference matcher MAY exclude auxiliary identifier namespaces.
- A missing rule mapping MUST fail configuration loading rather than inherit an `SV-*` ID.
- Internal failures after configuration loads MUST use the configured internal rule.

## SV-CFG-004 — Repository policy ownership

**Requirement.** Consumer repositories MUST own their paths, requirement IDs, statuses, document dialects, validator selection, and additional check lanes while the package owns reusable mechanisms.

### Acceptance details

- The package MUST NOT contain repository-named presets or foreign path maps.
- Consumer configuration MUST be able to express mapped or any-chapter spec-first policy, grouped verification rows and row multiplicity, repository-specific Storybook roots and SUMMARY link styles, exact forbidden filesystem entries, and repository-owned table and acceptance-detail dialects.
- Structured additional lanes MUST use separate `name`, `command`, and `args` fields without shell-word splitting.
- A repository-specific check MAY remain a named lane until a reusable validator exists.
