/**
 * SV-ARCH-008 and SV-ARCH-009 architecture checker: counted-line budgets,
 * generic dump filenames, and production isolation from tests.
 *
 * Run through `deno task check:architecture`. This is first-party Deno
 * automation, so it MUST use Deno and Web APIs only (SV-ARCH-005) and is
 * audited by `scripts/check-runtime-boundaries.ts`.
 */

import { countedLines, physicalLines } from "./architecture-lines.ts";
import {
  DEFAULT_LIMITS,
  DUMP_NAMES,
  fileKind,
  isDumpPath,
  isSourceFile,
  isTestSpecifier,
  toPosix,
  type FileKind,
  LIMIT_KEYS,
} from "./architecture-policy.ts";

const SKIP_DIRS = new Set([
  ".cache",
  ".deno",
  ".git",
  ".jj",
  ".qmd",
  "dist",
  "node_modules",
]);
const SOURCE_ROOTS = [
  "src",
  "scripts",
  "tests",
  "packages/workspace-tools/src",
];
const FIXTURE_ROOT = "scripts/architecture-fixtures";
const IMPORT_RE = /(?:from|import)\s*["']([^"']+)["']/gu;
const STALE_SLACK = 20;

export interface ArchitectureOptions {
  root?: string;
  writeBaseline?: boolean;
  baselinePath?: string;
  ci?: boolean;
  quiet?: boolean;
}

export interface ArchitectureFinding {
  rule: string;
  message: string;
  file: string;
  line?: number;
}

export interface ArchitectureReport {
  ok: boolean;
  errors: ArchitectureFinding[];
  files: Record<string, BaselineEntry>;
}

export interface BaselineEntry {
  countedLines: number;
  physicalLines: number;
  forbiddenImportCount: number;
}

export interface Baseline {
  version: number;
  sourceCommit: string;
  limits: Record<string, number>;
  files: Record<string, BaselineEntry>;
}

export function parseArgs(argv: string[]): ArchitectureOptions {
  const options: ArchitectureOptions = { writeBaseline: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write-baseline") options.writeBaseline = true;
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--root") options.root = argv[++index];
    else if (arg === "--baseline") options.baselinePath = argv[++index];
  }
  return options;
}

function walkSources(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    let entries: Deno.DirEntry[];
    try {
      entries = [...Deno.readDirSync(directory)];
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = `${directory}/${entry.name}`;
      if (entry.isDirectory) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const relative = toPosix(full.slice(root.length + 1));
        if (
          relative === FIXTURE_ROOT ||
          relative.startsWith(`${FIXTURE_ROOT}/`)
        ) {
          continue;
        }
        visit(full);
        continue;
      }
      if (entry.isFile && isSourceFile(entry.name)) files.push(full);
    }
  };
  for (const sourceRoot of SOURCE_ROOTS) visit(`${root}/${sourceRoot}`);
  return files.sort();
}

function readBaseline(baselinePath: string): Baseline | null {
  try {
    return JSON.parse(Deno.readTextFileSync(baselinePath)) as Baseline;
  } catch {
    return null;
  }
}

function sourceCommit(root: string): string {
  try {
    const result = new Deno.Command("jj", {
      args: [
        "--no-pager",
        "log",
        "-r",
        "@",
        "-n",
        "1",
        "--no-graph",
        "-T",
        "commit_id",
      ],
      cwd: root,
      stdout: "piped",
      stderr: "null",
    }).outputSync();
    if (!result.success) return "unknown";
    return new TextDecoder().decode(result.stdout).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function productionTestImports(source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    if (isTestSpecifier(match[1]!)) hits.push(match[1]!);
  }
  return hits;
}

/** Enforce the counted-line ratchet across the repository source roots. */
export function checkArchitecture(
  options: ArchitectureOptions = {},
): ArchitectureReport {
  const repoRoot = (options.root ?? Deno.cwd()).replace(/\/+$/u, "");
  const baselineFile =
    options.baselinePath ?? `${repoRoot}/scripts/architecture-baseline.json`;
  const writeBaseline = options.writeBaseline === true;
  const quiet = options.quiet === true;
  const errors: ArchitectureFinding[] = [];

  const report = (rule: string, message: string, file: string): void => {
    errors.push({ rule, message, file });
    if (!quiet) console.error(`${file} [${rule}] ${message}`);
  };

  // Only a baseline write consults CI, so the read-only lane needs no env
  // permission beyond `--allow-env=CI` on the write task.
  if (writeBaseline && (options.ci ?? Deno.env.get("CI") === "true")) {
    report(
      "write-baseline-forbidden",
      "refusing --write-baseline because CI is true",
      "scripts/architecture-baseline.json",
    );
    return { ok: false, errors, files: {} };
  }

  const sources = walkSources(repoRoot);
  if (sources.length === 0) {
    report("no-inputs", "architecture check found no source files", repoRoot);
    return { ok: false, errors, files: {} };
  }

  const records = sources.map((full) => {
    const posix = toPosix(full.slice(repoRoot.length + 1));
    const source = Deno.readTextFileSync(full);
    const kind: FileKind = fileKind(posix);
    const testImports = productionTestImports(source);
    return {
      posix,
      kind,
      counted: countedLines(source),
      physical: physicalLines(source),
      forbiddenImportCount: kind === "production" ? testImports.length : 0,
      testImports,
    };
  });

  const baseline = writeBaseline ? null : readBaseline(baselineFile);
  if (!writeBaseline && !baseline) {
    report(
      "architecture-baseline-missing",
      `architecture baseline is missing; write it with deno task check:architecture:baseline`,
      toPosix(baselineFile.slice(repoRoot.length + 1)) ||
        "scripts/architecture-baseline.json",
    );
    return { ok: false, errors, files: {} };
  }

  const limits = { ...DEFAULT_LIMITS, ...(baseline?.limits ?? {}) };
  const recorded = baseline?.files ?? {};
  const snapshot: Record<string, BaselineEntry> = {};

  if (baseline) {
    const present = new Set(records.map((record) => record.posix));
    for (const posix of Object.keys(recorded)) {
      if (!present.has(posix)) {
        report(
          "missing-baseline-path",
          "deleted or renamed; update the baseline in this change",
          posix,
        );
      }
    }
  }

  for (const record of records) {
    if (isDumpPath(record.posix)) {
      report(
        "dump-filename",
        `generic dump filename or directory is not allowed (${[...DUMP_NAMES].join(", ")})`,
        record.posix,
      );
    }
    for (const specifier of record.testImports) {
      report(
        "production-test-import",
        `production module imports test ${specifier}`,
        record.posix,
      );
    }

    const limit =
      limits[LIMIT_KEYS[record.kind]] ??
      DEFAULT_LIMITS[LIMIT_KEYS[record.kind]]!;
    const priorEntry = writeBaseline ? undefined : recorded[record.posix];
    if (!writeBaseline && !priorEntry) {
      if (record.counted > limit) {
        report(
          "new-file-budget",
          `new ${record.kind} file is ${record.counted}/${limit} counted lines`,
          record.posix,
        );
      }
    } else if (!writeBaseline && priorEntry) {
      const budget = priorEntry.countedLines;
      if (record.counted > budget) {
        report(
          "counted-line-growth",
          `counted-line growth ${budget} -> ${record.counted}; extract or update the baseline in this change`,
          record.posix,
        );
      } else if (record.counted + STALE_SLACK < budget) {
        report(
          "stale-budget",
          `counted ${record.counted} plus ${STALE_SLACK} slack is under the recorded budget ${budget}; lower the baseline`,
          record.posix,
        );
      }
    }

    snapshot[record.posix] = {
      countedLines: record.counted,
      physicalLines: record.physical,
      forbiddenImportCount: record.forbiddenImportCount,
    };
  }

  if (writeBaseline) {
    const payload: Baseline = {
      version: 1,
      sourceCommit: sourceCommit(repoRoot),
      limits,
      files: Object.fromEntries(
        Object.keys(snapshot)
          .sort((a, b) => a.localeCompare(b))
          .map((key) => [key, snapshot[key]!]),
      ),
    };
    // `scripts/` is tracked, so the baseline directory always exists and the
    // write task needs permission for the baseline file only.
    Deno.writeTextFileSync(
      baselineFile,
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    if (!quiet) {
      console.log(
        `Wrote ${Object.keys(snapshot).length} architecture baseline entries.`,
      );
    }
    return { ok: true, errors: [], files: snapshot };
  }

  return { ok: errors.length === 0, errors, files: snapshot };
}

if (import.meta.main) {
  const result = checkArchitecture(parseArgs(Deno.args));
  Deno.exitCode = result.ok ? 0 : 1;
}
