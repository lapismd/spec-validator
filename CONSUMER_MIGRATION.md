# Consumer migration

This tracker is non-normative. Canonical behavior remains under `spec/src`.

| Consumer     | Legacy command                                                                   | Shared command            | Parity  | Remaining local lanes | JJ change |
| ------------ | -------------------------------------------------------------------------------- | ------------------------- | ------- | --------------------- | --------- |
| Design Core  | `node scripts/spec-validation/index.mjs`                                         | `spec-validator validate` | Pending | Pending               | Pending   |
| CV Roles     | `node scripts/spec-validation/index.mjs`                                         | `spec-validator validate` | Pending | Pending               | Pending   |
| Mira         | `node scripts/check-spec-structure.mjs && node scripts/check-spec-storybook.mjs` | `spec-validator validate` | Pending | Pending               | Pending   |
| Visual Delta | `node scripts/check-spec-structure.mjs`                                          | `spec-validator validate` | Pending | `ci:image:check`      | Pending   |
| Lapis Notes  | `node scripts/spec-validation/index.mjs`                                         | `spec-validator validate` | Pending | Pending               | Pending   |

Migration requires side-by-side success, equivalent fixture classification and
governing requirement IDs, the consumer aggregate gate, and an independent
Jujutsu commit before the legacy implementation is removed.
