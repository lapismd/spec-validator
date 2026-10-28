# Architecture

The repository is a pure Node package: pnpm owns dependency installation and repository tasks, TypeScript compiles `src` to the published `dist` output, and Node 22 or newer is the only runtime requirement for contributors and consumers.

## Public surface coverage

| Surface                | Public boundary | Requirement |
| ---------------------- | --------------- | ----------- |
| CLI and registry       | Architecture    | SV-ARCH-001 |
| Tracked-file discovery | Architecture    | SV-ARCH-002 |
| Plugin contract        | Architecture    | SV-ARCH-003 |
| QMD system install     | Architecture    | SV-ARCH-004 |
| Node workspace         | Architecture    | SV-ARCH-005 |
| Public package         | Architecture    | SV-ARCH-006 |
| Trusted publication    | Architecture    | SV-ARCH-007 |
| Counted-line budgets   | Architecture    | SV-ARCH-008 |
| Module isolation       | Architecture    | SV-ARCH-009 |

## SV-ARCH-001 — CLI and registry

**Requirement.** The package MUST expose a `spec-validator` binary, typed configuration helpers, neutral profiles, and a validator registry that runs only the validators enabled by a consumer.

### Acceptance details

- The published npm bin MUST resolve to `dist/cli.js` and start with a Node shebang, and the repository CLI MUST run the same built artifact.
- `defineConfig` MUST compose typed configuration fragments, including definition and reference matchers, exact repository-layout entries, verification multiplicity, mirror link styles, and table acceptance-detail policy; neutral profiles MUST provide reusable defaults without embedding repository policy.
- Disabled validators MUST NOT run during `validate` or `check`; live book serving MUST use the installed runtime adapter for asynchronous commands and source watching.
- The registry MUST accept extra plugin modules that export `name` and `validate`, and package builds MUST remove stale node output before compilation.

## SV-ARCH-002 — Tracked-file discovery

**Requirement.** Validation that inspects repository membership MUST prefer Jujutsu tracked files and MUST fall back to Git, failing closed when neither can list files.

### Acceptance details

- Discovery MUST run `jj --no-pager file list -r @` first; configured document roles MUST restrict requirement definitions without suppressing document/link validation.
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

## SV-ARCH-004 — QMD system install

**Requirement.** QMD MUST remain an operator-owned system tool resolved from PATH, and the package MUST NOT declare `@tobilu/qmd` or its native modules as dependencies.

### Acceptance details

- Search and doctor MUST invoke the PATH `qmd` binary per SV-QMD-002 and MUST NOT rely on a repository-local or bundled QMD runtime.
- `@tobilu/qmd` MUST NOT appear in the published dependency or peer-dependency lists.
- Dependency installation MUST resolve through the tracked pnpm lockfile, and any dependency requiring lifecycle scripts MUST be approved explicitly rather than silently.

## SV-ARCH-005 — Node workspace

**Requirement.** Node 22 or newer MUST be the canonical repository runtime, with pnpm owning installation and package scripts owning tasks, tests, and first-party automation.

### Acceptance details

- The root MUST contain one `package.json` and one `pnpm-lock.yaml`, MUST NOT contain `deno.json`, `deno.lock`, or Deno entry points, and MUST validate the built npm surface with `publint`.
- `pnpm install --frozen-lockfile` MUST reproduce every development dependency before validation in CI.
- Cross-repository orchestration MUST use the versioned workspace schema, explicit dependency directions, build freshness checks, and content-addressed invalidation for declared deterministic tasks; active repository tasks and guidance MUST invoke pnpm package scripts rather than Deno or Turbo.
- A runtime-boundary audit MUST fail on residual Deno globals, `jsr:` imports, or retired Deno runtime files in first-party source, scripts, tests, and workspace tooling.

## SV-ARCH-006 — Public package

**Requirement.** The npm artifact MUST be a self-contained public package whose metadata identifies the canonical public source and whose contents match the documented runtime contract.

### Acceptance details

- The manifest MUST declare public npm access and identify `https://github.com/lapismd/spec-validator` as the canonical public repository, homepage, and issue tracker root.
- The package allowlist MUST contain only built runtime and type output, the optional usage skill, README, changelog, license, and package metadata.
- Runtime and optional peer dependencies MUST use portable semver ranges without local protocols or machine paths.
- The packed binary, Node exports, documentation files, and license MUST resolve without consulting the source checkout.

## SV-ARCH-007 — Trusted npm publication

**Requirement.** Stable npm releases MUST be published from an exact repository tag through GitHub Actions trusted publishing, with the validated package artifact preserved across the publication boundary.

### Acceptance details

- The publication workflow MUST run only for `v*` tags and reject a tag whose version does not exactly match `package.json`.
- The package gate MUST install from the frozen pnpm lockfile, run the canonical checks and tests, and upload exactly one npm tarball.
- The publication job MUST download that verified tarball and use the protected `npm-production` environment with GitHub OIDC publish-only permission rather than an npm token.
- A successful or retry-safe already-published release MUST verify the installed version, registry signatures, and Sigstore provenance, then create or retain a non-draft, non-prerelease GitHub Release for the exact existing tag.

## SV-ARCH-008 — Counted-line budgets

**Requirement.** First-party source MUST stay inside counted-line budgets enforced by a first-party Node architecture checker that fails closed when its baseline is missing.

### Acceptance details

- Counted lines MUST be physical lines minus blank and comment-only lines, matching the shared LapisMD metric.
- New production and script files MUST stay at or under 300 counted lines and new tests at or under 500.
- A baselined file MUST NOT grow counted lines without an updated `scripts/architecture-baseline.json` in the same change.
- A recorded budget MUST fail when the current size plus twenty is still below it, and `--write-baseline` MUST be refused when `CI` is true.

## SV-ARCH-009 — Module isolation

**Requirement.** Production source MUST stay isolated from tests and MUST NOT use generic dump filenames.

### Acceptance details

- A production module MUST NOT import a `.test` or `.spec` specifier.
- Files and directories named `utils`, `helpers`, `common`, or `services` MUST be rejected.
- The checker MUST audit `src/`, `scripts/`, `tests/`, and `packages/workspace-tools/src/` while excluding its own fixtures.

## Counted-line ratchet

`src/validators/`, `src/commands/`, `src/platform/`, and `src/presets/` already
own the repository structure, so SV-ARCH-008 and SV-ARCH-009 add a size and
naming ratchet rather than a folder taxonomy. `scripts/check-architecture.ts`
records the current budgets in `scripts/architecture-baseline.json`; a later
change that needs room MUST extract into a named module and lower the budget in
the same change.

The package claims no import-direction layer matrix. The surfaces in each
coverage table are public boundaries, not layers, so the architecture checker
enforces size, naming, and production isolation from tests only.

The versioned JSON report envelope carries optional `degraded` and `warning`
fields so a search that fell back to `rg` stays machine-readable; the fallback
contract itself is normative in
[Search and QMD](./search-and-qmd.md) as SV-QMD-002.

`pnpm check:architecture` runs the gate and `pnpm check` and
`pnpm test:all` own it. The checker is first-party Node automation under
SV-ARCH-005 and stays covered by the `pnpm audit:runtime` boundary audit
in `scripts/check-runtime-boundaries.ts`.

The bounded-document delivery extracts validator defaults, document-role classification and JJ diff parsing into owned modules before recording the updated counted-line baseline. New modules remain inside the 300-line budget.

Release qualification installs mdBook 0.5.2 before canonical checks and the actual nested-book regression. The failed v0.1.1 package gate exposed an absent CI binary, not a passing substitute; v0.1.2 retains that regression and qualifies the explicit prerequisite.

The verified release tarball lives under `.release/`; artifact upload explicitly includes hidden files while restricting its path to that one tarball pattern. The v0.1.2 gate passed all tests but artifact upload excluded the hidden directory; v0.1.3 preserves the failed tag and the exact validated artifact boundary.
