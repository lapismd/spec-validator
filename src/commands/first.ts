import { loadResolvedConfig } from "../config.js";
import { diagnostic } from "../diagnostics.js";
import type { Reporter } from "../reporter.js";
import {
  changesFromVcs,
  classifySpecFirstChanges,
  findingsFromResult,
} from "../validators/spec-first.js";
import { readFlag } from "../argv.js";

export async function firstCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  try {
    const config = await loadResolvedConfig(repoRoot);
    const options = config.validators.specFirst;
    if (options === false) {
      reporter.writeReport({
        version: 1,
        ok: true,
        exitCode: 0,
        message: "Spec-first is disabled.",
      });
      return 0;
    }
    const files: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
      if (argv[index] === "--file") {
        files.push(argv[index + 1] ?? "");
        index += 1;
      }
    }
    const result = classifySpecFirstChanges(
      changesFromVcs(
        {
          base: readFlag(argv, "--base"),
          head: readFlag(argv, "--head"),
          files: files.filter(Boolean),
        },
        repoRoot,
      ),
      options,
    );
    const findings = findingsFromResult(result, config.ruleIds.specFirst);
    const message = result.ok
      ? result.requiresSpec
        ? `Spec-first gate passed: ${result.protectedFiles.length} protected file(s), ${result.specFiles.length} canonical chapter(s).`
        : "Spec-first gate passed: no protected files changed."
      : "Spec-first gate failed.";
    reporter.writeReport({
      version: 1,
      ok: result.ok,
      exitCode: result.ok ? 0 : 1,
      findings: result.ok ? undefined : findings,
      stats: {
        protected: result.protectedFiles.length,
        chapters: result.specFiles.length,
      },
      message: result.ok ? message : undefined,
    });
    if (!result.ok && !reporter.json) {
      reporter.writeError(message);
      for (const chapter of result.missingChapters)
        reporter.writeError(`  Missing mapped chapter: ${chapter}`);
      for (const file of result.unmappedProductionFiles)
        reporter.writeError(`  Unmapped protected file: ${file}`);
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    const finding = diagnostic({
      code: "SPEC-FIRST-VCS",
      rule: "SV-GOV-004",
      file: "spec/src/spec-governance.md",
      message: error instanceof Error ? error.message : String(error),
    });
    reporter.writeReport({
      version: 1,
      ok: false,
      exitCode: 2,
      findings: [finding],
    });
    return 2;
  }
}
