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
`pnpm spec:first` to check the local Jujutsu diff, or pass `--base` and `--head`
for an explicit CI revision range. The canonical path map is in
[`spec-governance.md`](./spec/src/spec-governance.md#change-map).

Use `pnpm spec:search -- "<topic or SV-ID>"` for lexical discovery before a
broad scan. Add `--semantic` only when conceptual retrieval is useful. QMD is
a cache, not an authority: open the returned file and line in `spec/src`
before acting. When QMD is unavailable, follow the reported `rg` fallback.
Run `pnpm spec:check` and `pnpm build:node` after specification or protected
surface work.

A code-only behavior change is prohibited even when tests pass. When code and
specification disagree, treat the code as defective unless an explicit
specification change is accepted.

## Colocated sibling dependencies

- Consume a colocated LapisMD sibling through an explicit `link:` dependency or
  a `link:`-valued root `pnpm-workspace.yaml` override; do not add the sibling
  repository as a workspace member.
- Keep publishable manifests portable. Do not vendor sibling source, edit its
  `node_modules`, or replace a local checkout with a registry copy.
- When a sibling exports built output, rebuild it before validating this
  repository as a consumer.

## Workflow

1. Inspect `jj --no-pager st` and preserve unrelated changes.
2. Read the relevant specification page and requirement IDs.
3. Update the specification and verification map before implementation.
4. Add focused regression evidence for the changed boundary.
5. Run `pnpm spec:check` and `pnpm build:node`.
6. Commit the verified slice with Jujutsu. This is a standing request; do not
   wait for the user to ask.

Generated `spec/book/` output is ignored and non-normative. Commit only mdBook
configuration, canonical Markdown, and enforcement tooling.

Prefer `--json` when parsing CLI output. Color is TTY-only unless
`--color=always` is set; `--no-color` and `NO_COLOR` disable ANSI.

## Skill

`pnpm exec spec-validator skill install` copies the usage skill only to
`~/.agents/skills/spec-validator/SKILL.md`. Do not install Cursor or project
skill copies.
