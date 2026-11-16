# Doctor and init

`init` scaffolds a consumer. `doctor` verifies wiring and can apply safe repairs.

## Public surface coverage

| Surface                        | Public boundary | Requirement |
| ------------------------------ | --------------- | ----------- |
| Init scaffolds                 | Doctor and init | SV-DOC-001  |
| Doctor report                  | Doctor and init | SV-DOC-002  |
| Doctor fix safety              | Doctor and init | SV-DOC-003  |
| Configured canonical discovery | Doctor and init | SV-DOC-004  |

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

## SV-DOC-004 — Configured canonical discovery

**Requirement.** Doctor MUST discover verification matrices from the resolved validator configuration rather than require a fixed consumer layout.

### Acceptance details

- Enabled verification MUST use `file` when `files` is empty, otherwise match the configured regular expressions against Markdown chapter paths relative to `specDir`.
- Missing literal files and empty pattern selections MUST fail even when an unselected default matrix exists.
- Every selected matrix MUST receive a discrete presence check; disabled verification MUST impose no matrix requirement.
- A missing `SUMMARY.md` MUST fail independently of verification selection.

## Qualification evidence

The public CLI regression records5 failures and1 pass before repair, covering
nested literal/pattern selection, precedence and disabled verification. It also
retains default/missing-file controls, summary failure and strict wrapped-alias
warnings. Terminal's configured `current/verification.md` is the original
consumer reproduction; packed CLI acceptance remains distinct from adoption.

The repaired source passes6/6 focused CLI tests and the full check: typecheck,
Node runtime audit, lowered architecture budget,5 specification lanes,
6 workspace tests,19 architecture controls,67 Node tests, mdBook and publint.
Formatter and own doctor/QMD checks pass with the intentional wrapped-alias
warning retained. A temporary packed public CLI (SHA256
77f4ad226c357eab0a00686816eeb33a0c3f9b2fd3e86128dbe3bb3546f6f361)
accepts Terminal's configured matrix with10 passes and one wrapped-alias warning;
Terminal manifest, lock, workflows and WIP are unchanged. No package is published
or consumer dependency adopted by this source qualification.
