# Search and QMD

QMD is a local discovery cache over canonical Markdown. It is not an authority and is not part of `check`.

## Public surface coverage

| Surface | Public boundary | Requirement |
| --- | --- | --- |
| Discovery commands | Search and QMD | SV-QMD-001 |
| Host and fallback | Search and QMD | SV-QMD-002 |

## SV-QMD-001 — Discovery commands

**Requirement.** `search` and `index` MUST refresh the tracked collection before querying, and semantic mode MUST embed before vector retrieval.

### Acceptance details

- The tracked `.qmd/index.yml` MUST name the configured collection and index `spec/src/**/*.md`.
- Lexical `search` MUST run `qmd update` then `qmd search`.
- `--semantic` MUST run `qmd embed` then `qmd vsearch`.
- `check` and CI lanes MUST NOT invoke `search` or `index`.

## SV-QMD-002 — Host and fallback

**Requirement.** `@tobilu/qmd` MUST remain an optional peer dependency, and a missing binary, missing native binding, or ABI mismatch MUST print an `rg` fallback instead of pretending the index is authoritative.

### Acceptance details

- The wrapper MUST resolve the consumer-local `node_modules/.bin/qmd` and capture its stdout and stderr.
- A Node ABI mismatch MUST tell the operator to reinstall under the active Node version.
- A missing native binding MUST tell the operator to approve `better-sqlite3` and `node-llama-cpp` in the root pnpm config and reinstall.
- The fallback MUST be `rg -n -i --glob '*.md' '<query>' spec/src`.
