# Changelog

## 0.2.0

Migrate the package to a pure Node runtime: pnpm and package scripts replace
the Deno task runner, the `deno` export condition and bundled Deno build are
removed, and `init`/`doctor` now maintain only the `spec:*` package-script
aliases that call the installed binary. QMD search resolves the system-installed
`qmd` from PATH and degrades environmental QMD failures (missing binary, ABI
mismatch, missing native binding, unavailable embedding model) to an executed
`rg` fallback with a repair warning and exit status 0; non-zero search exits are
reserved for usage errors and `index`. `doctor` gains a `qmd-native` probe that
names the exact npm repair command.

## 0.1.4

Keep nested book serving live after source and navigation edits, remove deleted staged pages, and resolve named-scope search results to absolute source files with their original line numbers.

## 0.1.3

Upload the exact validated tarball from the hidden release directory, retaining the artifact-only trusted publication boundary.

## 0.1.2

Install pinned mdBook 0.5.2 in trusted publication CI so the real nested-book regression and canonical book build run on the release runner; retain the failed v0.1.1 tag without replacement.

## 0.1.1

Add optional document roles, globally checked split verification, physical-line and UTF-8-byte limits, bounded nested navigation, scoped lexical/semantic search, mapped topic alternatives and fresh consumer-validated unchanged-contract confirmations. Explicit JJ ranges and default merge checks now use JJ without requiring a colocated Git checkout.

## 0.1.0 - 2026-08-27

First public npm release of the configurable specification validator.

- Provides the Deno 2.9.5 CLI and a Node.js 22+ compatible npm binary and typed
  library.
- Includes specification, Storybook-catalog, package, repository, and QMD
  validation with repository-owned configuration.
- Includes the optional global Agents skill and Deno-first LapisMD workspace
  tooling.
