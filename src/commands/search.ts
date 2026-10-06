import { fallback, nativeOrFallbackMessage } from "./search-host.js";
export {
  looksLikeAbiMismatch,
  looksLikeMissingNativeBinding,
  nativeModuleAdvice,
} from "./search-host.js";
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
          value: ["--limit", "-n", "--scope"],
          positionals: true,
        }
      : { boolean: ["--semantic"], value: ["--scope"] },
  );
  const config = await loadResolvedConfig(repoRoot);
  const options = config.validators.qmd;
  if (options === false) {
    return fail(reporter, "QMD is disabled in spec-validator config.");
  }
  const scopeIndex = argv.indexOf("--scope");
  const scope = scopeIndex >= 0 ? argv[scopeIndex + 1]! : options.defaultScope;
  const selected = scope
    ? options.scopes[scope]
    : { collection: options.collection, path: config.specDir };
  if (!selected)
    throw new UsageError(
      `unknown search scope ${scope}; choose ${Object.keys(options.scopes).join(", ")}`,
    );
  const sourceRoot = selected.path;
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
      if (scopeIndex >= 0 && index === scopeIndex + 1) return false;
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
        sourceRoot,
      )}`,
    );
  }
  const binary = resolveQmdBinary(repoRoot);
  if (!existsSync(binary)) {
    return fail(
      reporter,
      `Missing the repository-local QMD binary; run deno install --frozen=false.\n${fallback(
        query,
        sourceRoot,
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
        sourceRoot,
      )}`,
      refresh.status ?? 1,
    );
  }
  if (semantic) {
    const embed = run(["embed", "-c", selected.collection]);
    if ((embed.status ?? 1) !== 0) {
      return fail(
        reporter,
        `Specification embedding or model initialization failed; retry or omit --semantic.\n${nativeOrFallbackMessage(
          embed,
          query,
          sourceRoot,
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
    selected.collection,
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
      `Specification search failed.\n${nativeOrFallbackMessage(search, query, sourceRoot)}`,
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
