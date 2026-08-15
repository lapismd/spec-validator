# @lapismd/spec-validator

`@lapismd/spec-validator` is a configurable CLI and TypeScript library for
repositories that treat Markdown specifications as a governed, testable
contract. It keeps canonical specification chapters, verification evidence,
generated mdBook documentation, and implementation changes in sync.

The package provides reusable validators for:

- requirement headings or tables and acceptance details;
- verification matrices and requirement coverage;
- mdBook structure, summaries, and generated-output hygiene;
- specification-first changes based on Jujutsu or Git diffs;
- package manifests, public surfaces, repository layouts, and package docs;
- Storybook catalog entries and documentation mirrors; and
- optional QMD indexing and specification search.

The validator owns these reusable mechanisms. Each consuming repository keeps
control of its paths, requirement IDs, statuses, enabled checks, diagnostic
mappings, Storybook conventions, and additional validation lanes.

## Requirements

- Node.js 22 or newer
- pnpm for the examples below
- mdBook when the `build`, `serve`, or aggregate `check` commands are enabled

QMD support is optional and only required for `search` and `index`.

## Install and initialize

```bash
pnpm add -D @lapismd/spec-validator
pnpm exec spec-validator init --profile heading
pnpm exec spec-validator check
```

Use `--profile table` for a table-based requirement specification. Without an
explicit profile, `init` detects the current specification shape. It scaffolds
missing configuration, mdBook files, package scripts, and the generated-book
ignore rule without replacing unrelated files.

Configuration is loaded from the first matching root file:
`spec-validator.config.ts`, `spec-validator.config.mjs`, or
`spec-validator.config.json`.

## Configuration

TypeScript and JavaScript configurations can compose neutral profiles with
repository-owned policy:

```ts
import {
  defineConfig,
  headingRequirements,
  singleIdVerification,
} from "@lapismd/spec-validator";

export default defineConfig(headingRequirements(), {
  name: "my-package",
  idPattern: /^APP-[A-Z]+-\d{3}$/,
  ruleIds: {
    summary: "APP-GOV-001",
    governance: "APP-GOV-001",
    verification: "APP-GOV-002",
    book: "APP-GOV-003",
    bookIgnore: "APP-GOV-003",
    internal: "APP-GOV-001",
  },
  validators: {
    summary: true,
    governance: true,
    verification: singleIdVerification(),
    book: true,
  },
});
```

Built-in validators are disabled unless a config or profile enables them. Run
`spec-validator list` to inspect the resolved validator set.

## CLI commands

| Command    | Purpose                                                        |
| ---------- | -------------------------------------------------------------- |
| `validate` | Run the enabled specification validators                       |
| `check`    | Run validation, configured lanes, mdBook build, and spec-first |
| `build`    | Build the mdBook                                               |
| `serve`    | Serve the mdBook locally                                       |
| `first`    | Check protected changes for matching specification updates     |
| `search`   | Search the configured QMD specification collection             |
| `index`    | Refresh the QMD specification collection                       |
| `list`     | List enabled built-in validators and plugins                   |
| `init`     | Scaffold configuration, scripts, and optional agent skill      |
| `doctor`   | Verify configuration and repository wiring; optionally fix it  |
| `skill`    | Install the global Agents usage skill with `skill install`     |

Examples:

```bash
pnpm exec spec-validator validate --only governance,verification
pnpm exec spec-validator first --base main --head @
pnpm exec spec-validator doctor --fix --skill
pnpm exec spec-validator search -- "SV-GOV-001"
```

Pretty color output is used on a TTY. Pass `--json` for versioned,
machine-readable output, `--no-color` to disable ANSI, or `--color=always` when
piping human-readable output.

## Optional QMD support

Install `@tobilu/qmd` as a root development dependency when enabling QMD. pnpm
must also allow the `better-sqlite3` and `node-llama-cpp` build scripts so the
local index can open. QMD is a discovery cache; canonical Markdown remains the
authority.

## Library API

The package exports `defineConfig`, neutral configuration and verification
profiles, config resolution helpers, the specification model, diagnostics, and
`runCli`. Public TypeScript types include `UserConfig`, `ResolvedConfig`,
`Diagnostic`, `VerificationOptions`, and `CheckLaneConfig`.

Canonical requirements live in [`spec/src`](./spec/src). The contributor
workflow and required validation commands live in [`AGENTS.md`](./AGENTS.md).
