import { assertCommandArgs } from "../argv.js";
import { loadResolvedConfig } from "../config.js";
import { runtime, spawnSync } from "../platform/current.js";
import type { Reporter } from "../reporter.js";
import type { CheckLaneConfig, CheckLaneResult } from "../types.js";
import { runFirst } from "./first.js";
import { runValidation } from "./validate.js";

function runLane(config: CheckLaneConfig, repoRoot: string): CheckLaneResult {
  const result = spawnSync(config.command, config.args ?? [], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: runtime.platform === "win32",
  });
  const exitCode = result.status ?? 1;
  return {
    name: config.name,
    ok: exitCode === 0,
    exitCode,
    stdout: result.stdout?.trimEnd() || undefined,
    stderr: (result.stderr || result.error?.message)?.trimEnd() || undefined,
  };
}

export async function checkCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  assertCommandArgs(argv, { value: ["--base", "--head", "--file"] });
  const config = await loadResolvedConfig(repoRoot);
  const lanes: CheckLaneResult[] = [];
  const validation = await runValidation(repoRoot);
  lanes.push({
    name: "validate",
    ok: validation.ok,
    exitCode: validation.ok ? 0 : 1,
    findings: validation.findings,
    stats: validation.stats,
  });

  if (validation.ok) {
    for (const lane of config.check.lanes) {
      const result = runLane(lane, repoRoot);
      lanes.push(result);
      if (!result.ok) break;
    }
  }
  if (lanes.every((lane) => lane.ok) && config.check.build) {
    lanes.push(
      runLane(
        { name: "mdbook", command: "mdbook", args: ["build", "./spec"] },
        repoRoot,
      ),
    );
  }
  if (lanes.every((lane) => lane.ok) && config.check.first) {
    const first = await runFirst(repoRoot, argv);
    lanes.push({
      name: "spec-first",
      ok: first.ok,
      exitCode: first.exitCode,
      findings: first.findings,
      stats: first.stats,
    });
  }

  const firstFailure = lanes.find((lane) => !lane.ok);
  const exitCode = firstFailure?.exitCode ?? 0;
  reporter.writeReport({
    version: 1,
    ok: !firstFailure,
    exitCode,
    lanes,
    message: firstFailure
      ? `Check stopped after ${firstFailure.name}.`
      : `Check passed: ${lanes.length} lane(s).`,
  });
  return exitCode;
}
