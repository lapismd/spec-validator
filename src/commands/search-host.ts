import { runtime } from "../platform/current.js";
export function fallback(query?: string, sourceRoot = "spec/src"): string {
  const term = query ? query.replaceAll("'", "'\\''") : "<query>";
  return `Fallback: rg -n -i --glob '*.md' '${term}' '${sourceRoot.replaceAll("'", "'\\''")}'`;
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

export function nativeOrFallbackMessage(
  result: {
    stdout?: string | null;
    stderr?: string | null;
    error?: Error;
  },
  query?: string,
  sourceRoot = "spec/src",
): string {
  const advice = nativeModuleAdvice(result);
  const details = advice ?? outputOf(result).trim();
  return [details, fallback(query, sourceRoot)].filter(Boolean).join("\n");
}
