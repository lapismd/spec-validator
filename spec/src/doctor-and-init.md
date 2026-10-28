# Doctor and init

`init` scaffolds a consumer. `doctor` verifies wiring and can apply safe repairs.

## Public surface coverage

| Surface           | Public boundary | Requirement |
| ----------------- | --------------- | ----------- |
| Init scaffolds    | Doctor and init | SV-DOC-001  |
| Doctor report     | Doctor and init | SV-DOC-002  |
| Doctor fix safety | Doctor and init | SV-DOC-003  |

## SV-DOC-001 — Init scaffolds

**Requirement.** `init` MUST write a neutral-profile config and missing book or ignore scaffolding without clobbering unrelated consumer files unless `--force` is set.

### Acceptance details

- `init` MUST inspect existing requirement IDs and document structure when choosing a neutral heading or table profile.
- `init` MUST merge the canonical `spec:*` package-script aliases that call the installed `spec-validator` binary without removing unrelated scripts.
- `--skill` MUST install only the global Agents skill.
- `--force` MUST be required before replacing an existing config and MUST replace its format rather than create a competing file.

## SV-DOC-002 — Doctor report

**Requirement.** `doctor` MUST report config, spec files, book, ignore rules, optional QMD tooling and native-module health, mdBook, and npm script wiring as discrete checks with pass, warn, or fail status.

### Acceptance details

- Pretty output MUST group checks and print a short summary.
- `--json` MUST include every check name, status, and message.
- `--strict` MUST treat remaining warnings as failure.
- When QMD is enabled, missing tooling MUST warn without failing `validate`, and a system-binary probe MUST fail an ABI mismatch or missing native binding with the exact `npm` repair command.

## SV-DOC-003 — Doctor fix safety

**Requirement.** `doctor --fix` MAY write missing ignore lines, QMD config, npm script aliases, skill files, and `book.toml` fields, and MUST NOT rewrite canonical specification chapters or invent requirement IDs.

### Acceptance details

- Fixes MUST be idempotent.
- `--fix` MUST report each applied repair.
- Canonical Markdown under `spec/src` MUST remain untouched.
- A repair that cannot be applied safely MUST stay a finding.
