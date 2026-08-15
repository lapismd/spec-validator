# Specification governance

Specification changes precede or accompany protected implementation. Updating an unrelated chapter does not satisfy a mapped change.

## Public surface coverage

| Surface             | Public boundary | Requirement |
| ------------------- | --------------- | ----------- |
| Verification matrix | Governance      | SV-GOV-002  |
| Diagnostic contract | Governance      | SV-GOV-003  |
| Spec-first gate     | Governance      | SV-GOV-004  |
| Generated artifacts | Governance      | SV-GOV-005  |
| Agent authority     | Governance      | SV-GOV-006  |
| Sibling resolution  | Governance      | SV-GOV-007  |

## Change map

| Protected area                                            | Owning canonical chapter |
| --------------------------------------------------------- | ------------------------ |
| CLI entry, argv, reporter, and color                      | `cli.md`                 |
| Config schema, loader, and neutral profiles               | `configuration.md`       |
| Built-in validators and plugin loading                    | `validators.md`          |
| Spec model and tracked-file discovery                     | `architecture.md`        |
| Doctor, init, and `--fix`                                 | `doctor-and-init.md`     |
| QMD search and index wrappers                             | `search-and-qmd.md`      |
| Skill payload and install command                         | `skill-and-agents.md`    |
| Specification chapters, book, QMD config, and agent guide | `spec-governance.md`     |
| Package manifests and build scripts                       | `architecture.md`        |

## SV-GOV-002 — Verification matrix

**Requirement.** Every requirement ID MUST appear in exactly one verification row with an allowed status and source or test evidence.

### Acceptance details

- Allowed statuses MUST be `Implemented`, `In progress`, or `Partial`.
- A missing, duplicate, or orphan row MUST fail validation.
- Empty evidence MUST fail validation.
- The verification chapter MUST remain indexed by `SUMMARY.md`.

## SV-GOV-003 — Diagnostic contract

**Requirement.** Every validation finding MUST include a stable error code, governing requirement ID, path, line, optional subject, and actionable message, and findings MUST sort deterministically.

### Acceptance details

- Exit code `1` MUST mean findings and exit code `2` MUST mean internal or VCS failure.
- A successful validate run MUST report validator, chapter, and requirement counts.
- Consumer `ruleIds` MUST supply the governing IDs written into diagnostics.
- Internal failures MUST use code `SPEC-INTERNAL`.

## SV-GOV-004 — Spec-first classification

**Requirement.** A protected source, config, CLI, doctor, init, skill, or package-script change MUST include every mapped canonical chapter in the same local or CI diff, and the gate MUST fail closed when the change set cannot be determined.

### Acceptance details

- Local runs MUST inspect the current Jujutsu change, or Git when Jujutsu is absent.
- CI MAY pass `--base` and `--head` for an explicit revision range.
- Tests, generated output, and ordinary fixtures MUST NOT satisfy or spuriously trigger the gate.
- Unmapped protected paths MUST fail rather than pass silently.

## SV-GOV-005 — Generated artifacts

**Requirement.** Generated mdBook output under `spec/book/` and generated QMD databases MUST remain untracked, and the ignore rules MUST stay committed.

### Acceptance details

- `.gitignore` MUST contain `spec/book/`.
- `.gitignore` MUST contain `.qmd/index.sqlite*` when QMD is enabled.
- Tracked files under `spec/book/` MUST fail the book validator.
- Doctor `--fix` MAY append missing ignore lines and MUST NOT invent requirement IDs.

## SV-GOV-006 — Agent authority

**Requirement.** Tracked `AGENTS.md` MUST state the authority order, spec-first workflow, QMD discovery rule, and Jujutsu commit loop for this package.

### Acceptance details

- The guide MUST tell agents to update the owning chapter before protected implementation.
- The guide MUST treat QMD hits as a cache and require opening the returned `spec/src` file.
- The guide MUST require `pnpm spec:check` and `pnpm build:node` before a verified commit.
- README and skill text MUST NOT replace this guide as the implementation contract.

## SV-GOV-007 — Sibling resolution

**Requirement.** Tracked `AGENTS.md` MUST require colocated LapisMD siblings to resolve through explicit `link:` dependencies or `link:`-valued root overrides without becoming workspace members.

### Acceptance details

- Publishable manifests MUST retain portable ranges without machine-specific sibling paths.
- Agents MUST NOT vendor sibling source, mutate sibling `node_modules`, or replace a local checkout with a registry copy.
- A sibling that exports built output MUST be rebuilt before consumer validation.
