import { toPosix } from "./model.js";
import { spawnSync } from "./platform/current.js";

function tracked(
  command: string,
  args: string[],
  repoRoot: string,
): { ok: true; files: string[] } | { ok: false; error: string } {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr.trim() || `${command} exited ${result.status}`,
    };
  }
  return {
    ok: true,
    files: result.stdout
      .split(/\r?\n/)
      .map((file) => toPosix(file.trim()))
      .filter(Boolean),
  };
}

export function discoverTrackedFiles(repoRoot: string): string[] {
  const jj = tracked("jj", ["--no-pager", "file", "list", "-r", "@"], repoRoot);
  if (jj.ok) return jj.files;
  const git = tracked("git", ["ls-files"], repoRoot);
  if (git.ok) return git.files;
  throw new Error(
    `cannot determine tracked files with jj (${jj.error}) or git (${git.error})`,
  );
}
