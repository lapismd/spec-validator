# Specification

`@lapismd/spec-validator` is the shared CLI for LapisMD specification governance. It validates canonical Markdown, mdBook wiring, verification matrices, spec-first diffs, optional Storybook catalog and mirror checks, and optional QMD discovery.

## Authority order

1. Higher-level workspace instructions and the tracked `AGENTS.md`.
2. The owning `SV-<AREA>-NNN` requirement and verification row in `spec/src`.
3. Public TypeScript exports and the `spec-validator` CLI contract.
4. Tests as verification evidence.
5. README, skill text, and generated mdBook output as explanation only.

## Non-goals

The package does not run `svelte-check`, Vitest, Playwright, Visual Delta, publint, or Tailwind bans. Those remain consumer-owned.

## Public surface coverage

| Surface | Public boundary | Requirement |
| --- | --- | --- |
| Authority order | Governance | SV-GOV-001 |
| Discovery cache | QMD | SV-QMD-001 |

## SV-GOV-001 — Canonical specification

**Requirement.** Canonical Markdown under `spec/src` MUST be the source of truth for package behavior, and generated or explanatory surfaces MUST NOT redefine that contract.

### Acceptance details

- An implementation change MUST update the owning chapter and verification row in the same logical slice.
- README, skill text, and generated mdBook output MUST remain non-normative.
- When code and specification disagree, the code MUST be treated as defective unless an explicit specification change is accepted.
- Agents MUST read the owning `SV-*` requirement before changing protected behavior.
