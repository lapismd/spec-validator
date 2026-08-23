# Workspace tools

`@lapismd/workspace-tools` provides Deno-first source linking and task
orchestration for separately versioned sibling repositories. It does not turn
the sibling checkouts into one workspace or replace their own locks.
The package manifest exposes both its library surface and `./cli` so sibling
declarations can validate the bootstrap entry point before synchronization.

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

- Each link MUST declare a package name, relative target, portable range, required exports, and required built files.
- Relative targets MUST resolve inside the declared shared workspace root.
- The package name and version read from the target manifest MUST satisfy the declaration before any task or mutation runs.
- Unknown fields, duplicate packages, invalid ranges, and malformed paths MUST fail closed with an actionable diagnostic.

## SV-WORK-002 — Link validation and synchronization

**Requirement.** `lapismd-workspace links check|sync` MUST validate declared sibling packages and materialize only owned package and binary symlinks.

### Acceptance details

- `check` MUST be read-only, while `sync` MUST record owned entries beneath `node_modules` without changing tracked source.
- Synchronization MUST refuse missing exports or build output, path escapes, target-name mismatches, and existing non-owned files or directories.
- Stale owned symlinks MAY be removed only when they still point at the recorded target.
- Repeated synchronization MUST be deterministic and idempotent.

## SV-WORK-003 — Cross-repository tasks

**Requirement.** `lapismd-workspace run <task>` MUST execute selected repositories in dependency order using each repository's canonical Deno task.

### Acceptance details

- Filters MUST match repository or declared package names and MAY include dependencies or dependents explicitly.
- Cycles, missing configurations, missing tasks, and failed child commands MUST stop execution with a non-zero status.
- Independent repositories MUST have deterministic ordering.
- Every child command MUST run from the owning repository root.

## SV-WORK-004 — Portable pack manifest

**Requirement.** `lapismd-workspace pack` MUST write a staging-only package manifest that replaces declared local dependency protocols with their portable release ranges.

### Acceptance details

- The source manifest MUST remain unchanged.
- The staged manifest MUST preserve unrelated metadata and dependency sections.
- Unmapped `link:`, `file:`, `workspace:`, or absolute dependency paths MUST fail rather than enter a publishable artifact.
- Packing MUST refuse an output path that resolves to the source manifest.
