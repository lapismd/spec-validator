# Architecture

The repository is Deno-first while publishing a Node-compatible CLI and TypeScript library. Deno owns dependency installation, repository tasks, tests, and first-party automation; npm metadata and built `dist` output remain the portable consumer contract.

## Public surface coverage

| Surface                | Public boundary | Requirement |
| ---------------------- | --------------- | ----------- |
| CLI and registry       | Architecture    | SV-ARCH-001 |
| Tracked-file discovery | Architecture    | SV-ARCH-002 |
| Plugin contract        | Architecture    | SV-ARCH-003 |
| QMD native builds      | Architecture    | SV-ARCH-004 |
| Deno workspace         | Architecture    | SV-ARCH-005 |
| Public package         | Architecture    | SV-ARCH-006 |
| Trusted publication    | Architecture    | SV-ARCH-007 |

## SV-ARCH-001 — CLI and registry

**Requirement.** The package MUST expose a `spec-validator` binary, typed configuration helpers, neutral profiles, and a validator registry that runs only the validators enabled by a consumer.

### Acceptance details

- The published npm bin MUST resolve to `dist/cli.js` and start with a Node shebang, while the repository CLI MUST also run directly under Deno.
- `defineConfig` MUST compose typed configuration fragments, including definition and reference matchers, exact repository-layout entries, verification multiplicity, mirror link styles, and table acceptance-detail policy; neutral profiles MUST provide reusable defaults without embedding repository policy.
- Disabled validators MUST NOT run during `validate` or `check`.
- The registry MUST accept extra plugin modules that export `name` and `validate`, and package builds MUST remove stale node output before compilation.

## SV-ARCH-002 — Tracked-file discovery

**Requirement.** Validation that inspects repository membership MUST prefer Jujutsu tracked files and MUST fall back to Git, failing closed when neither can list files.

### Acceptance details

- Discovery MUST run `jj --no-pager file list -r @` first.
- Discovery MUST fall back to `git ls-files` when Jujutsu is unavailable.
- An unreadable working copy MUST produce exit code `2` rather than an empty success.
- Paths MUST be reported with POSIX separators.

## SV-ARCH-003 — Plugin contract

**Requirement.** Every validator MUST receive a shared context with the spec model, tracked files, resolved config, and optional file reads, MUST exclude fenced authoring examples from canonical structures, and MUST return structured diagnostics.

### Acceptance details

- `validate(context)` MUST return an array of diagnostics with `code`, `rule`, `file`, `line`, optional `subject`, and `message`.
- Findings MUST sort by file, line, code, then subject.
- Plugins listed in config MUST load from paths relative to the consumer root.
- A plugin load or validate throw MUST become an internal failure with exit code `2`.

## SV-ARCH-004 — QMD native builds

**Requirement.** Root Deno configuration MUST approve only the reviewed QMD native lifecycle scripts, and `@tobilu/qmd` MUST remain a root-only optional peer rather than a published runtime dependency.

### Acceptance details

- Deno `allowScripts` MUST allow `better-sqlite3`, `node-llama-cpp`, and local test tooling that requires lifecycle scripts.
- `@tobilu/qmd` MUST stay an optional peer and root development dependency.
- Those native approvals MUST NOT enter a published runtime dependency list.
- `esbuild` MAY be approved for local test tooling.

## SV-ARCH-005 — Deno workspace

**Requirement.** Deno 2.9.5 MUST be the canonical repository runtime, installer, task runner, and lockfile owner while npm artifacts remain compatible with supported Node consumers.

### Acceptance details

- The root MUST contain one `deno.json` and one `deno.lock`, use manually installed isolated `node_modules`, reject any other Deno version through a canonical version-check task, expose its built portable Deno entry point by package name, and validate the built npm surface with `publint`.
- `deno ci` MUST reproduce dependencies from the frozen lock before validation.
- Cross-repository orchestration MUST use the versioned workspace schema, explicit dependency directions, build freshness checks, and content-addressed invalidation for declared deterministic tasks; active repository tasks and guidance MUST invoke Deno rather than pnpm or Turbo, while package lifecycle scripts MAY delegate to canonical Deno tasks.
- First-party Deno automation MUST use Deno or Web APIs; Node APIs MUST stay in explicit npm compatibility adapters and tests.

## SV-ARCH-006 — Public package

**Requirement.** The npm artifact MUST be a self-contained public package whose metadata identifies the canonical public source and whose contents match the documented runtime contract.

### Acceptance details

- The manifest MUST declare public npm access and identify `https://github.com/lapismd/spec-validator` as the canonical public repository, homepage, and issue tracker root.
- The package allowlist MUST contain only built runtime and type output, the optional usage skill, README, changelog, license, and package metadata.
- Runtime and optional peer dependencies MUST use portable semver ranges without local protocols or machine paths.
- The packed binary, Node and Deno exports, documentation files, and license MUST resolve without consulting the source checkout.

## SV-ARCH-007 — Trusted npm publication

**Requirement.** Stable npm releases MUST be published from an exact repository tag through GitHub Actions trusted publishing, with the validated package artifact preserved across the publication boundary.

### Acceptance details

- The publication workflow MUST run only for `v*` tags and reject a tag whose version does not exactly match `package.json`.
- The package gate MUST install from the frozen Deno lockfile, run the canonical checks and tests, and upload exactly one npm tarball.
- The publication job MUST download that verified tarball and use the protected `npm-production` environment with GitHub OIDC publish-only permission rather than an npm token.
- A successful or retry-safe already-published release MUST verify the installed version, registry signatures, and Sigstore provenance, then create or retain a non-draft, non-prerelease GitHub Release for the exact existing tag.
