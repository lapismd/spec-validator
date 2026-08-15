import { assertCommandArgs, readFlag, UsageError } from "../argv.js";
import { loadResolvedConfig, resolveDiagnosticRule } from "../config.js";
import { diagnostic } from "../diagnostics.js";
import type { Reporter } from "../reporter.js";
import type { Diagnostic } from "../types.js";
import {
  changesFromVcs,
  classifySpecFirstChanges,
  findingsFromResult,
} from "../validators/spec-first.js";

export interface FirstResult {
  ok: boolean;
  exitCode: number;
  findings: Diagnostic[];
  stats: { protected: number; chapters: number };
  message: string;
}

function parseFirstArgs(argv: string[]) {
  assertCommandArgs(argv, { value: ["--base", "--head", "--file"] });
  const base = readFlag(argv, "--base");
  const head = readFlag(argv, "--head");
  if (head && !base) throw new UsageError("--head requires --base");
  const files: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--file") {
      files.push(argv[index + 1]!);
      index += 1;
    }
  }
  return { base, head, files };
}

export async function runFirst(
  repoRoot: string,
  argv: string[] = [],
): Promise<FirstResult> {
  const selection = parseFirstArgs(argv);
  const config = await loadResolvedConfig(repoRoot);
  const options = config.validators.specFirst;
  if (options === false) {
    return {
      ok: true,
      exitCode: 0,
      findings: [],
      stats: { protected: 0, chapters: 0 },
      message: "Spec-first is disabled.",
    };
  }
  try {
    const result = classifySpecFirstChanges(
      changesFromVcs(selection, repoRoot),
      options,
    );
    const findings = findingsFromResult(result, config.ruleIds.specFirst).map(
      (finding) => ({
        ...finding,
        rule: resolveDiagnosticRule(config, "specFirst", finding.code),
      }),
    );
    return {
      ok: result.ok,
      exitCode: result.ok ? 0 : 1,
      findings,
      stats: {
        protected: result.protectedFiles.length,
        chapters: result.specFiles.length,
      },
      message: result.ok
        ? result.requiresSpec
          ? `Spec-first gate passed: ${result.protectedFiles.length} protected file(s), ${result.specFiles.length} canonical chapter(s).`
          : "Spec-first gate passed: no protected files changed."
        : "Spec-first gate failed.",
    };
  } catch (error) {
    const code = "SPEC-FIRST-VCS";
    return {
      ok: false,
      exitCode: 2,
      findings: [
        diagnostic({
          code,
          rule: resolveDiagnosticRule(config, "specFirst", code),
          file: "spec/src/spec-governance.md",
          message: error instanceof Error ? error.message : String(error),
        }),
      ],
      stats: { protected: 0, chapters: 0 },
      message: "Spec-first could not determine a trustworthy change set.",
    };
  }
}

export async function firstCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  const result = await runFirst(repoRoot, argv);
  reporter.writeReport({
    version: 1,
    ok: result.ok,
    exitCode: result.exitCode,
    findings: result.findings.length ? result.findings : undefined,
    stats: result.stats,
    message: result.ok ? result.message : undefined,
  });
  if (!result.ok && !reporter.json) reporter.writeError(result.message);
  return result.exitCode;
}
