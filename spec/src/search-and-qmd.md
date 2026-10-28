# Search and QMD

QMD is a local discovery cache over canonical Markdown. It is not an authority and is not part of `check`.

## Public surface coverage

| Surface            | Public boundary | Requirement |
| ------------------ | --------------- | ----------- |
| Discovery commands | Search and QMD  | SV-QMD-001  |
| Host and fallback  | Search and QMD  | SV-QMD-002  |

## SV-QMD-001 — Discovery commands

**Requirement.** `search` and `index` MUST refresh the tracked collection before querying, semantic mode MUST embed before vector retrieval, and each command MUST reject options outside its schema.

### Acceptance details

- The tracked `.qmd/index.yml` MUST name the configured collections and index canonical Markdown; optional named scopes MUST select their declared collection and equivalent source root, with an explicit default scope.
- Lexical `search` MUST run `qmd update` then `qmd search`; named-scope results MUST resolve to absolute files within that source root while retaining QMD source line numbers.
- `--semantic` MUST run `qmd embed` then `qmd vsearch`.
- `check` and CI lanes MUST NOT invoke `search` or `index`.

## SV-QMD-002 — Host and fallback

**Requirement.** The wrapper MUST resolve the system `qmd` binary from PATH, and an environmental QMD failure MUST degrade `search` to an executed `rg` fallback with a repair warning and exit status `0` instead of pretending the index is authoritative.

### Acceptance details

- The wrapper MUST resolve `qmd` from the operator PATH, capture its stdout and stderr, and MUST NOT require a repository-local or Deno-installed runtime.
- An ABI mismatch or missing native binding MUST name the active Node ABI and the exact `npm` system-install repair commands, and an unavailable embedding model MUST advise a retry without `--semantic`.
- A degraded `search` MUST execute `rg -n -i --glob '*.md' '<query>' '<selected-source-root>'`, defaulting to spec/src for unscoped consumers, print the captured results, warn with the repair command and a `spec-validator doctor` pointer, and exit `0`; an unavailable `rg` MUST print that fallback command instead.
- Non-zero exit statuses MUST remain reserved for usage errors and for `index`, which MUST report the same repair guidance when a refresh fails.
