import { existsSync, path, runtime, spawnSync } from "../platform/current.js";
import type { CommandResult } from "../platform/types.js";
import type { Reporter } from "../reporter.js";

/** Pinned system QMD release that matches the tracked collection schema. */
export const QMD_PACKAGE = "@tobilu/qmd@2.5.3";
export const QMD_INSTALL_COMMAND = `npm install -g --allow-scripts=better-sqlite3,node-llama-cpp ${QMD_PACKAGE}`;
export const QMD_REBUILD_COMMAND = "npm rebuild -g better-sqlite3";

export function fallback(query?: string, sourceRoot = "spec/src"): string {
  const term = query ? query.replaceAll("'", "'\\''") : "<query>";
  return `Fallback: rg -n -i --glob '*.md' '${term}' '${sourceRoot.replaceAll("'", "'\\''")}'`;
}

function qmdNames(platform: string): string[] {
  return platform === "win32"
    ? ["qmd.cmd", "qmd.exe", "qmd.bat", "qmd"]
    : ["qmd"];
}

/** Resolve the system-installed `qmd` binary from the operator PATH. */
export function findQmdOnPath(
  env: Record<string, string | undefined> = runtime.env,
  platform: string = runtime.platform,
): string | undefined {
  for (const directory of (env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    for (const name of qmdNames(platform)) {
      const candidate = path.join(directory, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function outputOf(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): string {
  return [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .join("\n");
}

export function looksLikeAbiMismatch(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): boolean {
  return /NODE_MODULE_VERSION|different Node\.js version|ERR_DLOPEN_FAILED|Module did not self-register|compiled against.*Node/i.test(
    outputOf(result),
  );
}

export function looksLikeMissingNativeBinding(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): boolean {
  return /Could not locate the bindings file|better_sqlite3\.node|Cannot find module ['"]better-sqlite3|node-llama-cpp/i.test(
    outputOf(result),
  );
}

export function looksLikeModelUnavailable(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): boolean {
  return /could not download|unable to download|failed to download|ENOTFOUND|ECONNREFUSED|ERR_NETWORK|embedding model|no such model|model .* not found/i.test(
    outputOf(result),
  );
}

export function nativeModuleAdvice(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): string | undefined {
  if (looksLikeAbiMismatch(result)) {
    const host = runtime.nodeAbi
      ? `Node ABI ${runtime.nodeAbi}`
      : "Node runtime";
    return `QMD native modules do not match the active ${host}; repair the system install with \`${QMD_REBUILD_COMMAND}\` or reinstall with \`${QMD_INSTALL_COMMAND}\`.`;
  }
  if (looksLikeMissingNativeBinding(result)) {
    return `QMD native modules are not built; reinstall the system binary with \`${QMD_INSTALL_COMMAND}\`.`;
  }
  if (looksLikeModelUnavailable(result)) {
    return "The QMD embedding model is unavailable; retry when it can download or omit --semantic.";
  }
  return undefined;
}

export function qmdFailureDetail(result: CommandResult): string {
  return nativeModuleAdvice(result) ?? outputOf(result).trim();
}

export interface RgFallbackResult {
  available: boolean;
  lines: string[];
}

/** Execute the documented `rg` discovery fallback inside the consumer repo. */
export function runRgFallback(
  repoRoot: string,
  query: string,
  sourceRoot: string,
): RgFallbackResult {
  const result = spawnSync(
    "rg",
    ["-n", "-i", "--glob", "*.md", query, sourceRoot],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...runtime.env, PWD: repoRoot },
      shell: runtime.platform === "win32",
    },
  );
  if (result.error || result.status === null || (result.status ?? 1) > 1) {
    return { available: false, lines: [] };
  }
  return {
    available: true,
    lines: (result.stdout ?? "").split("\n").filter((line) => line !== ""),
  };
}

export function degradedWarning(detail: string): string {
  return `${detail} Run \`spec-validator doctor\` to verify QMD health after the repair.`;
}

/** Warn, execute the rg discovery fallback, and keep the exit status at 0. */
export function degradeToRg(
  reporter: Reporter,
  repoRoot: string,
  detail: string,
  query: string,
  sourceRoot: string,
): number {
  const warning = degradedWarning(detail);
  const rg = runRgFallback(repoRoot, query, sourceRoot);
  const lines = rg.available ? rg.lines : [fallback(query, sourceRoot)];
  if (reporter.json) {
    reporter.writeReport({
      version: 1,
      ok: true,
      exitCode: 0,
      degraded: true,
      warning,
      results: lines,
    });
    return 0;
  }
  reporter.writeError(
    `spec-validator: search degraded to the rg fallback. ${warning}`,
  );
  for (const line of lines) reporter.writeLine(line);
  return 0;
}
