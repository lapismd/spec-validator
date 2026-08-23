import { assertCommandArgs } from "../argv.js";
import { runtime, spawnSync } from "../platform/current.js";
import type { Reporter } from "../reporter.js";

export function buildCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
  mode: "build" | "serve" = "build",
): number {
  assertCommandArgs(argv);
  const args =
    mode === "serve" ? ["serve", "./spec", "--open"] : ["build", "./spec"];
  const result = spawnSync("mdbook", args, {
    cwd: repoRoot,
    stdio: reporter.json ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: runtime.platform === "win32",
  });
  const status = result.status ?? 1;
  if (reporter.json) {
    reporter.writeReport({
      version: 1,
      ok: status === 0,
      exitCode: status === 0 ? 0 : 1,
      message: result.stdout || result.stderr || `${mode} exited ${status}`,
    });
  }
  return status === 0 ? 0 : 1;
}
