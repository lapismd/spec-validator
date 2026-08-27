# Verification

| Requirement | Status      | Evidence                                                                       |
| ----------- | ----------- | ------------------------------------------------------------------------------ |
| SV-GOV-001  | Implemented | `spec/src/index.md`; `AGENTS.md`; `src/validators/governance.ts`               |
| SV-GOV-002  | Implemented | `src/validators/verification.ts`; this chapter                                 |
| SV-GOV-003  | Implemented | `src/diagnostics.ts`; `src/commands/validate.ts`                               |
| SV-GOV-004  | Implemented | `src/validators/spec-first.ts`; `src/commands/first.ts`                        |
| SV-GOV-005  | Implemented | `src/validators/book.ts`; `src/validators/qmd.ts`; `.gitignore`                |
| SV-GOV-006  | Implemented | `AGENTS.md`; `src/validators/governance.ts` extras                             |
| SV-GOV-007  | Implemented | `AGENTS.md`; portable published dependency policy                              |
| SV-ARCH-001 | Implemented | `package.json` bin; linked-bin CLI regression; `src/config.ts`                 |
| SV-ARCH-002 | Implemented | `src/tracked-files.ts`                                                         |
| SV-ARCH-003 | Implemented | `src/types.ts`; `src/commands/validate.ts`                                     |
| SV-ARCH-004 | Implemented | `deno.json` lifecycle allowlist; package manifest checks                       |
| SV-ARCH-005 | Implemented | Deno package-import, exact-version, source-audit, frozen-CI, and publint tests |
| SV-ARCH-006 | Implemented | `package.json`; package publication contract test; packed consumer suite       |
| SV-CFG-001  | Implemented | `src/config.ts`; neutral profiles; five consumer configs                       |
| SV-CFG-002  | Implemented | `src/config.ts`; `src/commands/validate.ts`                                    |
| SV-CFG-003  | Implemented | diagnostic and reference resolution config tests                               |
| SV-CFG-004  | Implemented | five repository-owned configs; `CONSUMER_MIGRATION.md`                         |
| SV-VAL-001  | Implemented | built-in validator registry; focused validator regression tests                |
| SV-VAL-002  | Implemented | `src/commands/list.ts`; validator options                                      |
| SV-VAL-003  | Implemented | nested index and structural-group order tests; five consumer parity migrations |
| SV-CLI-001  | Implemented | `src/cli.ts`; symlink-bin and strict command-schema tests                      |
| SV-CLI-002  | Implemented | `src/color.ts`; `src/reporter.ts`                                              |
| SV-CLI-003  | Implemented | `src/commands/check.ts`                                                        |
| SV-DOC-001  | Implemented | `src/commands/init.ts`                                                         |
| SV-DOC-002  | Implemented | `src/commands/doctor.ts`                                                       |
| SV-DOC-003  | Implemented | `src/commands/doctor.ts` `--fix`                                               |
| SV-QMD-001  | Implemented | `src/commands/search.ts`; `.qmd/index.yml`                                     |
| SV-QMD-002  | Implemented | `src/commands/search.ts` fallback and native-binding classification            |
| SV-SKL-001  | Implemented | `src/commands/skill.ts`; `skill/spec-validator/SKILL.md`                       |
| SV-WORK-001 | Implemented | schema v2, fixtures, native `deno.json.links`, and parser tests                |
| SV-WORK-002 | Implemented | native-link, freshness, symlink-boundary, ownership, and sync tests            |
| SV-WORK-003 | Implemented | ordering, filters, dependent closure, cycles, and cache invalidation tests     |
| SV-WORK-004 | Implemented | staged manifest portability tests                                              |
