# Spec Validator agent guide

## Canonical specification

Normative package behavior lives under [`spec/src`](./spec/src). Apply this
authority order when sources disagree:

1. Higher-level workspace instructions and this tracked guide.
2. The owning `SV-<AREA>-NNN` requirement and verification row in `spec/src`.
3. Public source, exported types, and the `spec-validator` CLI contract.
4. Tests as verification evidence.
5. README, skill text, and generated or mirrored documentation.

Update the owning canonical chapter before or with a protected implementation,
CLI, config, doctor, init, skill, or package-script change. Requirements use a
unique `SV-<AREA>-NNN` heading, one concise normative statement, and two to four
atomic acceptance bullets. Add exactly one verification row. Run
`deno task spec:first` to check the local Jujutsu diff, or pass `--base` and
`--head` for an explicit CI revision range. The canonical path map is in
[`spec-governance.md`](./spec/src/spec-governance.md#change-map).

Use `deno task spec:search -- "<topic or SV-ID>"` for lexical discovery before a
broad scan. Add `--semantic` only when conceptual retrieval is useful. QMD is a
cache, not an authority: open the returned file and line in `spec/src` before
acting. When QMD is unavailable, follow the reported `rg` fallback. Run
`deno task spec:check` and `deno task build:node` after specification or
protected surface work.

A code-only behavior change is prohibited even when tests pass. When code and
specification disagree, treat the code as defective unless an explicit
specification change is accepted.

## Package dependency policy

- Consume published LapisMD packages through normal registry ranges.
- Keep publishable manifests portable. Do not vendor dependency source, edit
  dependency `node_modules`, or add checkout-specific paths.
- If a LapisMD dependency needs a source fix, make the change in the owning
  repository, verify it there, and consume a released package version here.

## Workflow

1. Inspect `jj --no-pager st` and preserve unrelated changes.
2. Read the relevant specification page and requirement IDs.
3. Update the specification and verification map before implementation.
4. Add focused regression evidence for the changed boundary.
5. Run `deno task spec:check` and `deno task build:node`.
6. Commit the verified slice with Jujutsu. This is a standing request; do not
   wait for the user to ask.

Generated `spec/book/` output is ignored and non-normative. Commit only mdBook
configuration, canonical Markdown, and enforcement tooling.

Prefer `--json` when parsing CLI output. Color is TTY-only unless
`--color=always` is set; `--no-color` and `NO_COLOR` disable ANSI.

## Skill

`deno run -A npm:@lapismd/spec-validator skill install` copies the usage skill
only to `~/.agents/skills/spec-validator/SKILL.md`. Do not install Cursor or
project skill copies.

## Counted-line architecture gate

Source structure lives in the existing `src/validators/`, `src/commands/`,
`src/platform/`, and `src/presets/` trees plus `packages/workspace-tools/src/`.
`scripts/check-architecture.ts` enforces SV-ARCH-008 and SV-ARCH-009: new
production and script files stay at or under 300 counted lines, new tests at or
under 500, and existing files do not grow counted lines without updating
`scripts/architecture-baseline.json` in the same change. Generic dump filenames
(`utils`, `helpers`, `common`, `services`) and production imports of tests are
rejected. Run `deno task check:architecture` with the relevant tests. Regenerate
the baseline with `deno task check:architecture:baseline` only after an
extraction lowers a budget; the gate refuses to write one when `CI` is true.

The checker is first-party Deno automation, so it MUST stay free of Node APIs
and remain covered by `deno task audit:runtime`.
