import { toPosix } from "../model.js";
import { existsSync, path, spawnSync } from "../platform/current.js";
import type { SpecFirstChange } from "./spec-first.js";
function normalizePath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
function parseDiffHeader(line: string): [string, string] | null {
  const source = line.slice("diff --git ".length);
  const match =
    /^(?:"((?:[^"\\]|\\.)*)"|(\S+))\s+(?:"((?:[^"\\]|\\.)*)"|(\S+))$/.exec(
      source,
    );
  if (!match) return null;
  const decode = (quoted: string | undefined, plain: string | undefined) => {
    const value = quoted === undefined ? plain : JSON.parse(`"${quoted}"`);
    return value?.replace(/^[ab]\//, "");
  };
  try {
    const before = decode(match[1], match[2]);
    const after = decode(match[3], match[4]);
    return before && after ? [before, after] : null;
  } catch {
    return null;
  }
}

export function parseUnifiedDiff(source: string): SpecFirstChange[] {
  const changes = new Map<string, SpecFirstChange>();
  let currentPaths: string[] = [];
  let sawHeader = false;
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const header = parseDiffHeader(line);
      if (!header) throw new Error(`unsupported unified diff header: ${line}`);
      sawHeader = true;
      currentPaths = [...new Set(header.map(normalizePath))];
      for (const currentPath of currentPaths) {
        if (!changes.has(currentPath)) {
          changes.set(currentPath, { path: currentPath, changedLines: [] });
        }
      }
      continue;
    }
    if (
      !currentPaths.length ||
      line.startsWith("+++") ||
      line.startsWith("---")
    ) {
      continue;
    }
    if (line.startsWith("+") || line.startsWith("-")) {
      for (const currentPath of currentPaths) {
        changes.get(currentPath)!.changedLines!.push(line.slice(1));
      }
    }
  }
  if (source.trim() && !sawHeader) {
    throw new Error(
      "non-empty change-set output contained no unified diff headers",
    );
  }
  return [...changes.values()];
}

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${
        result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`
      }`,
    );
  }
  return result.stdout;
}

export function changesFromVcs(
  options: { base?: string; head?: string; files?: string[] },
  repoRoot: string,
  execute = run,
): SpecFirstChange[] {
  if (options.files?.length)
    return options.files.map((file) => ({ path: toPosix(file) }));
  if (existsSync(path.join(repoRoot, ".jj"))) {
    const head = options.head ?? "@";
    const parents = options.base
      ? [options.base]
      : execute(
          "jj",
          [
            "--no-pager",
            "log",
            "-r",
            `${head}-`,
            "--no-graph",
            "-T",
            'commit_id ++ "\\n"',
          ],
          repoRoot,
        )
          .trim()
          .split("\n")
          .filter(Boolean);
    if (!parents.length)
      throw new Error("selected Jujutsu revision has no parent");
    return parents.flatMap((base) =>
      parseUnifiedDiff(
        execute(
          "jj",
          [
            "--no-pager",
            "--color=never",
            "diff",
            "--git",
            "--from",
            base,
            "--to",
            head,
          ],
          repoRoot,
        ),
      ),
    );
  }
  if (options.base || existsSync(path.join(repoRoot, ".git")))
    return parseUnifiedDiff(
      execute(
        "git",
        [
          "diff",
          "--no-ext-diff",
          "--unified=0",
          options.base ?? "HEAD",
          ...(options.base ? [options.head ?? "HEAD"] : []),
          "--",
        ],
        repoRoot,
      ),
    );
  throw new Error(
    "neither .jj nor .git is available; pass explicit --file paths",
  );
}
