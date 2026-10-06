import { loadResolvedConfig } from "../config.js";
import { stageBook } from "../book-staging.js";
import { watchBookSources } from "../book-serving.js";
import { assertCommandArgs } from "../argv.js";
import { runtime, spawnSync, spawnAsync } from "../platform/current.js";
import type { Reporter } from "../reporter.js";

export async function buildCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
  mode: "build" | "serve" = "build",
): Promise<number> {
  assertCommandArgs(argv);
  const config = await loadResolvedConfig(repoRoot);
  const book = stageBook(repoRoot, config);
  const args = mode === "serve" ? ["serve", book, "--open"] : ["build", book];
  const stop =
    mode === "serve"
      ? watchBookSources(repoRoot, config, (error) =>
          reporter.writeError(error.message),
        )
      : () => {};
  const options = {
    cwd: repoRoot,
    stdio: reporter.json
      ? (["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"])
      : ("inherit" as const),
    shell: runtime.platform === "win32",
  };
  const result = await (
    mode === "serve"
      ? spawnAsync("mdbook", args, options)
      : Promise.resolve(spawnSync("mdbook", args, options))
  ).finally(stop);
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
