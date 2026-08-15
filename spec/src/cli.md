# CLI

The `spec-validator` binary is the supported entry point. Global output flags apply to every command.

## Public surface coverage

| Surface                | Public boundary | Requirement |
| ---------------------- | --------------- | ----------- |
| Command surface        | CLI             | SV-CLI-001  |
| Human and agent output | CLI             | SV-CLI-002  |
| Check composition      | CLI             | SV-CLI-003  |

## SV-CLI-001 — Command surface

**Requirement.** The CLI MUST provide `validate`, `check`, `build`, `serve`, `first`, `search`, `index`, `list`, `init`, `doctor`, and `skill install` as first-class commands.

### Acceptance details

- `validate` MUST accept `--only` and `--skip` validator lists.
- `first` MUST accept `--base`, `--head`, and `--file`.
- `search` and `index` MUST stay outside `check`.
- Unknown commands or flags MUST print usage and exit `2`.

## SV-CLI-002 — Human and agent output

**Requirement.** Human runs MUST print a colored pretty report on a TTY, and agents MUST be able to request versioned JSON with no ANSI.

### Acceptance details

- Default color mode MUST be `auto` and MUST honor `NO_COLOR` and `FORCE_COLOR`.
- `--no-color` and `--color=never` MUST disable ANSI.
- `--json` MUST write at most one versioned object with `ok`, `exitCode`, and command results, including for aggregate checks and usage failures, and MUST NOT emit ANSI.
- Diagnostics MUST keep the `CODE RULE file:line [subject] — message` shape in pretty mode.

## SV-CLI-003 — Check composition

**Requirement.** `check` MUST run validate, optional markdownlint, optional configured tests, mdBook build, and spec-first, and MUST NOT refresh or query QMD.

### Acceptance details

- A failed earlier lane MUST stop the remaining lanes.
- The overall exit code MUST be the first non-zero lane status.
- `search` and `index` MUST remain available as separate commands.
- Pretty output MUST name each lane and result, while JSON output MUST contain ordered structured lane results with captured output.
