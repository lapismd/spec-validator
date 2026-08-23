import { assertCommandArgs, UsageError } from "../argv.js";
import { loadResolvedConfig } from "../config.js";
import { existsSync, path, runtime, spawnSync } from "../platform/current.js";
import type { Reporter } from "../reporter.js";

const DEFAULT_LIMIT = 10;

export function resolveQmdBinary(
  repoRoot: string,
  platform = runtime.platform,
): string {
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

export function nativeModuleAdvice(result: {
  stdout?: string | null;
  stderr?: string | null;
  error?: Error;
}): string | undefined {
  if (looksLikeAbiMismatch(result)) {
    const host = runtime.nodeAbi ? `Node ABI ${runtime.nodeAbi}` : "Deno 2.9.5";
    return `QMD native modules do not match the active ${host}; run deno install --frozen=false with the required Deno version.`;
  }
  if (looksLikeMissingNativeBinding(result)) {
    return "QMD native modules are not built; allow better-sqlite3 and node-llama-cpp scripts in deno.json, then run deno install --frozen=false.";
  }
  return undefined;
}

function nativeOrFallbackMessage(
  result: {
    stdout?: string | null;
    stderr?: string | null;
    error?: Error;
  },
  query?: string,
): string {
  const advice = nativeModuleAdvice(result);
  const details = advice ?? outputOf(result).trim();
  return [details, fallback(query)].filter(Boolean).join("\n");
}

function fail(reporter: Reporter, message: string, exitCode = 2): number {
  if (reporter.json) {
    reporter.writeReport({ version: 1, ok: false, exitCode, message });
  } else {
    reporter.writeError(message);
  }
  return exitCode;
}

export async function searchCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
  command: "search" | "index",
): Promise<number> {
  assertCommandArgs(
    argv,
    command === "search"
      ? {
          boolean: ["--semantic"],
          value: ["--limit", "-n"],
          positionals: true,
        }
      : { boolean: ["--semantic"] },
  );
  const config = await loadResolvedConfig(repoRoot);
  const options = config.validators.qmd;
  if (options === false) {
    return fail(reporter, "QMD is disabled in spec-validator config.");
  }
  const semantic = argv.includes("--semantic");
  const json = reporter.json;
  const limitIndex = argv.findIndex(
    (item) => item === "--limit" || item === "-n",
  );
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new UsageError("--limit must be a positive number");
  }
  const query = argv
    .filter((item, index) => {
      if (item.startsWith("-")) return false;
      if (limitIndex >= 0 && index === limitIndex + 1) return false;
      return true;
    })
    .join(" ")
    .trim();
  if (command === "search" && !query) {
    throw new UsageError("search requires a query");
  }

  const configPath = path.join(repoRoot, options.configPath);
  if (!existsSync(configPath)) {
    return fail(
      reporter,
      `Missing ${options.configPath}; restore the tracked QMD configuration.\n${fallback(
        query,
      )}`,
    );
  }
  const binary = resolveQmdBinary(repoRoot);
  if (!existsSync(binary)) {
    return fail(
      reporter,
      `Missing the repository-local QMD binary; run deno install --frozen=false.\n${fallback(
        query,
      )}`,
    );
  }

  const run = (args: string[]) =>
    spawnSync(binary, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...runtime.env, PWD: repoRoot },
      shell: runtime.platform === "win32",
    });

  const refresh = run(["update"]);
  if ((refresh.status ?? 1) !== 0) {
    return fail(
      reporter,
      `Specification index refresh failed.\n${nativeOrFallbackMessage(
        refresh,
        query,
      )}`,
      refresh.status ?? 1,
    );
  }
  if (semantic) {
    const embed = run(["embed", "-c", options.collection]);
    if ((embed.status ?? 1) !== 0) {
      return fail(
        reporter,
        `Specification embedding or model initialization failed; retry or omit --semantic.\n${nativeOrFallbackMessage(
          embed,
          query,
        )}`,
        embed.status ?? 1,
      );
    }
  }
  if (command === "index") {
    if (reporter.json) {
      reporter.writeReport({
        version: 1,
        ok: true,
        exitCode: 0,
        message: "Index refreshed.",
      });
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
    return fail(
      reporter,
      `Specification search failed.\n${nativeOrFallbackMessage(search, query)}`,
      search.status ?? 1,
    );
  } else if (search.stdout) {
    if (reporter.json) {
      let results: unknown = search.stdout.trim();
      try {
        results = JSON.parse(search.stdout);
      } catch {
        // Preserve unexpected QMD output inside the versioned envelope.
      }
      reporter.writeReport({ version: 1, ok: true, exitCode: 0, results });
    } else {
      reporter.writeLine(search.stdout.trimEnd());
    }
  } else if (reporter.json) {
    reporter.writeReport({ version: 1, ok: true, exitCode: 0, results: [] });
  }
  return 0;
}
