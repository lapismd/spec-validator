import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { UsageError } from "../argv.js";
import { loadResolvedConfig } from "../config.js";
import type { Reporter } from "../reporter.js";

const DEFAULT_LIMIT = 10;

export function resolveQmdBinary(repoRoot: string, platform = process.platform): string {
  return path.join(
    repoRoot,
    "node_modules",
    ".bin",
    platform === "win32" ? "qmd.cmd" : "qmd",
  );
}

function fallback(query?: string): string {
  const term = query ? query.replaceAll("'", "'\\''") : "<query>";
  return `Fallback: rg -n -i --glob '*.md' '${term}' spec/src`;
}

function outputOf(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): string {
  return [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n");
}

export function looksLikeAbiMismatch(result: { stdout?: string | null; stderr?: string | null; error?: Error }): boolean {
  return /NODE_MODULE_VERSION|different Node\.js version|ERR_DLOPEN_FAILED|Module did not self-register|compiled against.*Node/i.test(
    outputOf(result),
  );
}

export async function searchCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
  command: "search" | "index",
): Promise<number> {
  const config = await loadResolvedConfig(repoRoot);
  const options = config.validators.qmd;
  if (options === false) {
    reporter.writeError("QMD is disabled in spec-validator config.");
    return 2;
  }
  const semantic = argv.includes("--semantic");
  const json = reporter.json || argv.includes("--json");
  const limitIndex = argv.findIndex((item) => item === "--limit" || item === "-n");
  const limit =
    limitIndex >= 0 ? Number(argv[limitIndex + 1]) : DEFAULT_LIMIT;
  const query = argv
    .filter((item, index) => {
      if (item.startsWith("-")) return false;
      if (limitIndex >= 0 && index === limitIndex + 1) return false;
      return true;
    })
    .join(" ")
    .trim();
  if (command === "search" && !query) throw new UsageError("search requires a query");

  const configPath = path.join(repoRoot, options.configPath);
  if (!existsSync(configPath)) {
    reporter.writeError(`Missing ${options.configPath}; restore the tracked QMD configuration.`);
    reporter.writeError(fallback(query));
    return 2;
  }
  const binary = resolveQmdBinary(repoRoot);
  if (!existsSync(binary)) {
    reporter.writeError("Missing the repository-local QMD binary; run pnpm install.");
    reporter.writeError(fallback(query));
    return 2;
  }

  const run = (args: string[]) =>
    spawnSync(binary, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: json ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, PWD: repoRoot },
      shell: process.platform === "win32",
    });

  const refresh = run(["update"]);
  if ((refresh.status ?? 1) !== 0) {
    reporter.writeError("Specification index refresh failed.");
    if (looksLikeAbiMismatch(refresh)) {
      reporter.writeError(
        `QMD native modules do not match the active Node ABI ${process.versions.modules}; run pnpm install --force under the active Node version.`,
      );
    }
    reporter.writeError(fallback(query));
    return refresh.status ?? 1;
  }
  if (semantic) {
    const embed = run(["embed", "-c", options.collection]);
    if ((embed.status ?? 1) !== 0) {
      reporter.writeError(
        "Specification embedding or model initialization failed; retry or omit --semantic.",
      );
      reporter.writeError(fallback(query));
      return embed.status ?? 1;
    }
  }
  if (command === "index") {
    if (reporter.json) {
      reporter.writeReport({ version: 1, ok: true, exitCode: 0, message: "Index refreshed." });
    }
    return 0;
  }
  const search = run([
    semantic ? "vsearch" : "search",
    query,
    "-c",
    options.collection,
    "-n",
    String(Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT),
    "--format",
    json ? "json" : "md",
    "--full-path",
    "--line-numbers",
  ]);
  if ((search.status ?? 1) !== 0) {
    reporter.writeError("Specification search failed.");
    reporter.writeError(fallback(query));
  } else if (json && search.stdout) {
    reporter.writeLine(search.stdout.trimEnd());
  }
  return search.status ?? 1;
}
