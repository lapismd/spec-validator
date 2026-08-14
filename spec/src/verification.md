# Verification

| Requirement | Status | Evidence |
| --- | --- | --- |
| SV-GOV-001 | Implemented | `spec/src/index.md`; `AGENTS.md`; `src/validators/governance.ts` |
| SV-GOV-002 | Implemented | `src/validators/verification.ts`; this chapter |
| SV-GOV-003 | Implemented | `src/diagnostics.ts`; `src/commands/validate.ts` |
| SV-GOV-004 | Implemented | `src/validators/spec-first.ts`; `src/commands/first.ts` |
| SV-GOV-005 | Implemented | `src/validators/book.ts`; `src/validators/qmd.ts`; `.gitignore` |
| SV-GOV-006 | Implemented | `AGENTS.md`; `src/validators/governance.ts` extras |
| SV-ARCH-001 | Implemented | `package.json` bin; `src/cli.ts`; `src/config.ts` |
| SV-ARCH-002 | Implemented | `src/tracked-files.ts` |
| SV-ARCH-003 | Implemented | `src/types.ts`; `src/commands/validate.ts` |
| SV-ARCH-004 | Implemented | `package.json` `pnpm.onlyBuiltDependencies` |
| SV-CFG-001 | Implemented | `src/config.ts`; `src/presets.ts` |
| SV-CFG-002 | Implemented | `src/config.ts`; `src/commands/validate.ts` |
| SV-CFG-003 | Implemented | preset `ruleIds`; `src/config.ts` |
| SV-VAL-001 | Implemented | `src/validators/*.ts` |
| SV-VAL-002 | Implemented | `src/commands/list.ts`; validator options |
| SV-CLI-001 | Implemented | `src/cli.ts`; `src/commands/*.ts` |
| SV-CLI-002 | Implemented | `src/color.ts`; `src/reporter.ts` |
| SV-CLI-003 | Implemented | `src/commands/check.ts` |
| SV-DOC-001 | Implemented | `src/commands/init.ts` |
| SV-DOC-002 | Implemented | `src/commands/doctor.ts` |
| SV-DOC-003 | Implemented | `src/commands/doctor.ts` `--fix` |
| SV-QMD-001 | Implemented | `src/commands/search.ts`; `.qmd/index.yml` |
| SV-QMD-002 | Implemented | `src/commands/search.ts` fallback and native-binding classification |
| SV-SKL-001 | Implemented | `src/commands/skill.ts`; `skill/spec-validator/SKILL.md` |
