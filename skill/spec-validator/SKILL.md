---
name: spec-validator
description: Use the @lapismd/spec-validator CLI for specification discovery, validation, spec-first checks, doctor, and init. Use when editing spec/src, running spec:check, searching requirements, or diagnosing spec-validator config.
---

# Spec Validator

Canonical requirements live in the consumer `spec/src` tree. This skill does not
restate repository architecture.

## Discovery

1. Run `spec-validator search -- "<topic or requirement ID>"` from the repo root.
2. Open the returned `spec/src` file and line. Search hits are a cache, not authority.
3. If QMD is unavailable, use the printed `rg` fallback.

Add `--semantic` only for conceptual retrieval. Do not run `search` or `index`
as part of CI or `spec-validator check`.

## Changing protected behavior

1. Read the owning requirement and its verification row.
2. Update that chapter and verification evidence before or with the implementation.
3. Run `spec-validator check`. Prefer `--json` when parsing the result.
4. Do not treat passing tests as permission to skip a specification update.

## Output

- Humans: pretty TTY output with color.
- Agents: `spec-validator <command> --json`.
- Disable color with `--no-color` or `NO_COLOR=1`.

## Setup

- `spec-validator init --profile heading|table` detects the local requirement family and writes a repository-owned config plus script aliases.
- `spec-validator skill install` writes only `~/.agents/skills/spec-validator/SKILL.md`.
- `spec-validator doctor --fix` repairs safe repository wiring; add `--skill` only when global skill installation was explicitly requested.
