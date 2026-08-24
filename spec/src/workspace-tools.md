# Workspace tools

`@lapismd/workspace-tools` provides Deno-first source linking and task
orchestration for separately versioned sibling repositories. It does not turn
the sibling checkouts into one workspace or replace their own locks.
The package manifest exposes both its library surface and `./cli` so sibling
declarations can validate the bootstrap entry point before synchronization.
Deno resolves dependency-direction siblings through the tracked root
`deno.json.links` list. The synchronizer complements that native resolution by
materializing the package and binary links required by npm-compatible Node,
Vite, Storybook, and publishing tools.
Deno requires unscoped filesystem permission when creating symlinks, so the
tool itself MUST enforce the declared workspace and `node_modules` boundaries
before using that permission.

## Public surface coverage

| Surface                  | Public boundary | Requirement |
| ------------------------ | --------------- | ----------- |
| Repository declaration   | Workspace tools | SV-WORK-001 |
| Link validation and sync | Workspace tools | SV-WORK-002 |
| Cross-repository tasks   | Workspace tools | SV-WORK-003 |
| Portable pack manifest   | Workspace tools | SV-WORK-004 |

## SV-WORK-001 — Repository declaration

**Requirement.** Each participating repository MUST own a versioned `lapismd-workspace.json` that declares its identity, package names, shared workspace boundary, and every cross-repository dependency.

### Acceptance details

- Each repository MUST declare cacheable tasks only when their input and output paths are deterministic; each link MUST declare a package name, relative target, full recorded commit ID for CI checkout, portable range, dependency direction, required exports, and a build contract with task, inputs, and outputs, while every dependency-direction target MUST also appear in the tracked root `deno.json.links` list.
- The tracked JSON Schema and valid/invalid fixtures MUST describe the same fail-closed declaration contract as the runtime parser, including rejection of unknown fields, duplicate packages, invalid ranges, and malformed paths.
- Relative targets MUST resolve inside the declared shared workspace root.
- The package name, version, and required exports read from both the target npm manifest and its JSR-style `deno.json` package configuration MUST satisfy the declaration before any task or mutation runs.

## SV-WORK-002 — Link validation and synchronization

**Requirement.** `lapismd-workspace links check|sync` MUST validate declared sibling packages and materialize only owned package and binary symlinks.

### Acceptance details

- `check` MUST be read-only and reject missing or undeclared native Deno links, while `sync` MUST leave tracked `deno.json.links` unchanged and record only npm-compatibility entries beneath `node_modules`.
- Synchronization MUST refuse missing exports, missing or stale build output, path escapes including symbolic-link escapes, target-name mismatches, and existing non-owned files or directories.
- Stale owned symlinks MAY be removed only when they still point at the recorded target.
- Repeated synchronization MUST be deterministic and idempotent.

## SV-WORK-003 — Cross-repository tasks

**Requirement.** `lapismd-workspace run <task>` MUST execute selected repositories in dependency order using each repository's canonical Deno task.

### Acceptance details

- Filters MUST match repository or declared package names and MAY include dependencies or explicitly declared dependents.
- Cycles, missing configurations, missing tasks, and failed child commands MUST stop execution with a non-zero status.
- Independent repositories MUST have deterministic ordering, and every child command MUST run from the owning repository root.
- Declared deterministic tasks MUST reuse a content-addressed result only while every output exists and the declared input fingerprint is unchanged; `--no-cache` MUST force execution.

## SV-WORK-004 — Portable pack manifest

**Requirement.** `lapismd-workspace pack` MUST write a staging-only package manifest that replaces declared local dependency protocols with their portable release ranges.

### Acceptance details

- The source manifest MUST remain unchanged.
- The staged manifest MUST preserve unrelated metadata and dependency sections.
- Unmapped `link:`, `file:`, `workspace:`, or absolute dependency paths MUST fail rather than enter a publishable artifact.
- Packing MUST refuse an output path that resolves to the source manifest.
