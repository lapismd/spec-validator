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
- Lexical `search` MUST run `qmd update` then `qmd search`.
- `--semantic` MUST run `qmd embed` then `qmd vsearch`.
- `check` and CI lanes MUST NOT invoke `search` or `index`.

## SV-QMD-002 — Host and fallback

**Requirement.** `@tobilu/qmd` MUST remain an optional peer dependency, and a missing binary, missing native binding, or ABI mismatch MUST print an `rg` fallback instead of pretending the index is authoritative.

### Acceptance details

- The wrapper MUST resolve the consumer-local `node_modules/.bin/qmd` and capture its stdout and stderr.
- A runtime ABI mismatch MUST identify the active Deno or Node compatibility host and tell the operator to reinstall with Deno 2.9.5.
- A missing native binding MUST tell the operator to allow `better-sqlite3` and `node-llama-cpp` scripts in `deno.json` and reinstall with Deno.
- The fallback MUST be `rg -n -i --glob '*.md' '<query>' '<selected-source-root>'`, defaulting to spec/src for unscoped consumers.
