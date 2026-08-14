# Configuration

Consumers configure the CLI with `spec-validator.config.ts`, `.mjs`, or `.json` at the repository root.

## Public surface coverage

| Surface | Public boundary | Requirement |
| --- | --- | --- |
| Config files and presets | Configuration | SV-CFG-001 |
| Validator enablement | Configuration | SV-CFG-002 |
| Consumer rule IDs | Configuration | SV-CFG-003 |

## SV-CFG-001 — Config files and presets

**Requirement.** The loader MUST read the first existing `spec-validator.config.ts`, `.mjs`, or `.json` from the consumer root and MUST apply a named preset before consumer overrides.

### Acceptance details

- `defineConfig` MUST be the supported TypeScript helper.
- Unknown preset names MUST fail as an internal configuration error.
- A missing config MUST fail `validate`, `check`, and `doctor` unless `init` is creating one.
- Presets MUST exist for `spec-validator`, `design-core`, `lapis-notes`, `mira`, `visual-delta`, and `cv-roles`.

## SV-CFG-002 — Validator enablement

**Requirement.** Built-in validators MUST stay off unless a preset or explicit config enables them, and `false` MUST disable a preset validator.

### Acceptance details

- An options object MUST replace the preset options for that validator.
- CLI `--only` MUST run only the named validators for that invocation.
- CLI `--skip` MUST disable the named validators for that invocation.
- `plugins` MUST load additional `{ name, validate }` modules from the consumer root.

## SV-CFG-003 — Consumer rule IDs

**Requirement.** Diagnostic `rule` fields MUST use consumer-owned requirement IDs supplied by config or preset, and the engine MUST NOT rewrite those IDs to `SV-*` in a foreign repository.

### Acceptance details

- Each built-in validator MUST read its rule IDs from resolved config.
- The `spec-validator` preset MUST use `SV-*` IDs.
- Foreign presets MUST keep their existing `DC-*`, `LN-*`, `MIRA-*`, `VD-*`, or `LPR-*` IDs.
- A missing rule ID mapping MUST fail configuration loading.
