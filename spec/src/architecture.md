# Architecture

The package is a Node.js CLI with a loadable config, a validator registry, and a shared specification model. Consumers later link the built `dist` output.

## Public surface coverage

| Surface | Public boundary | Requirement |
| --- | --- | --- |
| CLI and registry | Architecture | SV-ARCH-001 |
| Tracked-file discovery | Architecture | SV-ARCH-002 |
| Plugin contract | Architecture | SV-ARCH-003 |
| QMD native builds | Architecture | SV-ARCH-004 |

## SV-ARCH-001 — CLI and registry

**Requirement.** The package MUST expose a `spec-validator` binary and a `defineConfig` export that load a consumer config, resolve a preset, and run only the enabled validators.

### Acceptance details

- The published bin MUST resolve to `dist/cli.js` and start with a Node shebang.
- `defineConfig` MUST return the supplied config object unchanged for TypeScript checking.
- Disabled validators MUST NOT run during `validate` or `check`.
- The registry MUST accept extra plugin modules that export `name` and `validate`.

## SV-ARCH-002 — Tracked-file discovery

**Requirement.** Validation that inspects repository membership MUST prefer Jujutsu tracked files and MUST fall back to Git, failing closed when neither can list files.

### Acceptance details

- Discovery MUST run `jj --no-pager file list -r @` first.
- Discovery MUST fall back to `git ls-files` when Jujutsu is unavailable.
- An unreadable working copy MUST produce exit code `2` rather than an empty success.
- Paths MUST be reported with POSIX separators.

## SV-ARCH-003 — Plugin contract

**Requirement.** Every validator MUST receive a shared context with the spec model, tracked files, resolved config, and optional file reads, and MUST return structured diagnostics.

### Acceptance details

- `validate(context)` MUST return an array of diagnostics with `code`, `rule`, `file`, `line`, optional `subject`, and `message`.
- Findings MUST sort by file, line, code, then subject.
- Plugins listed in config MUST load from paths relative to the consumer root.
- A plugin load or validate throw MUST become an internal failure with exit code `2`.

## SV-ARCH-004 — QMD native builds

**Requirement.** The root pnpm configuration MUST approve QMD native lifecycle scripts, and `@tobilu/qmd` MUST remain a root-only optional peer rather than a published runtime dependency.

### Acceptance details

- `package.json` `pnpm.onlyBuiltDependencies` MUST include `better-sqlite3` and `node-llama-cpp`.
- `@tobilu/qmd` MUST stay an optional peer and root development dependency.
- Those native approvals MUST NOT enter a published runtime dependency list.
- `esbuild` MAY be approved for local test tooling.
