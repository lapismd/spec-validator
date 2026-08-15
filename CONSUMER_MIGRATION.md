# Consumer migration

This tracker is non-normative. Canonical behavior remains under `spec/src`.

| Consumer     | Legacy command                                                                   | Shared command            | Parity                                                   | Remaining local lanes                    | JJ change              |
| ------------ | -------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------- | ---------------------------------------- | ---------------------- |
| Design Core  | `node scripts/spec-validation/index.mjs`                                         | `spec-validator validate` | Passed: validation, 33 legacy tests, shared gate         | None                                     | `3f433a9a`             |
| CV Roles     | `node scripts/spec-validation/index.mjs`                                         | `spec-validator validate` | Passed: validation, 2 legacy tests, shared gate          | None                                     | `ff5c3595`             |
| Mira         | `node scripts/check-spec-structure.mjs && node scripts/check-spec-storybook.mjs` | `spec-validator validate` | Passed: lint, structure, mirrors, 13 tests, shared gate  | Package and release domain checks        | `f15b6d24`, `55869083` |
| Visual Delta | `node scripts/check-spec-structure.mjs`                                          | `spec-validator validate` | Passed: lint, structure, 19 tests, shared aggregate gate | 8 domain script suites; `ci:image:check` | `26671f03`, `9ede24ec` |
| Lapis Notes  | `node scripts/spec-validation/index.mjs`                                         | `spec-validator validate` | Passed: 28 chapters, 559 IDs, 44 tests, shared gate      | None                                     | `6ca3ac84`             |

Migration requires side-by-side success, equivalent fixture classification and
governing requirement IDs, the consumer aggregate gate, and an independent
Jujutsu commit before the legacy implementation is removed.

All five consumers have completed that sequence. Repository-specific formats,
paths, statuses, auxiliary namespaces, and enforcement semantics remain in
their local config; the package owns only reusable parsing and validation.
