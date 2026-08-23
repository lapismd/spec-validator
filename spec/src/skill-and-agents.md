# Skill and agents

The shipped skill teaches agents how to use this CLI. It installs only to the user-global Agents tree.

## Public surface coverage

| Surface            | Public boundary  | Requirement |
| ------------------ | ---------------- | ----------- |
| Skill install path | Skill and agents | SV-SKL-001  |

## SV-SKL-001 — Skill install path

**Requirement.** `skill install` and `init --skill` MUST copy the shipped skill only to `~/.agents/skills/spec-validator/SKILL.md` and MUST NOT write Cursor or project skill trees.

### Acceptance details

- The command MUST NOT write `.cursor/skills/`, `~/.cursor/skills/`, or project `.agents/skills/`.
- The skill MUST tell agents to treat `spec/src` as authority, prefer `--json` when parsing CLI output, and use Deno tasks as the canonical automation entry points.
- The skill MUST NOT restate repository-specific architecture.
- Doctor MAY warn when the global skill file is absent and MAY install it only with `--fix --skill`.
