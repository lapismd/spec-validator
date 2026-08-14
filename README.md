# @lapismd/spec-validator

Shared CLI for LapisMD specification governance: canonical Markdown, mdBook,
verification matrices, spec-first diffs, optional Storybook catalog and mirror
checks, and optional QMD discovery.

## Install

```bash
pnpm add -D @lapismd/spec-validator
pnpm exec spec-validator init --preset design-core
```

`@tobilu/qmd` is an optional peer for `search` and `index`. Keep it as a root
development dependency when you enable QMD.

## Commands

```bash
spec-validator validate
spec-validator check
spec-validator first
spec-validator doctor --fix
spec-validator search -- "SV-GOV-001"
spec-validator skill install
```

Pretty color output is the default on a TTY. Use `--json` for agents,
`--no-color` to disable ANSI, or `--color=always` when piping.

Canonical requirements live in [`spec/src`](./spec/src). Agent workflow lives in
[`AGENTS.md`](./AGENTS.md).
