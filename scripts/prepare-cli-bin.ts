import { chmodSync, realpathSync, statSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CLI_PATH = resolve(
  scriptDirectory,
  "..",
  "dist",
  "cli.js",
);
export const CLI_SHEBANG = "#!/usr/bin/env node";

export function prepareCliBin(cliPath = DEFAULT_CLI_PATH) {
  const source = readFileSync(cliPath, "utf8");
  if (!source.startsWith(`${CLI_SHEBANG}\n`)) {
    throw new Error(`${cliPath} must start with ${CLI_SHEBANG}`);
  }
  chmodSync(cliPath, 0o755);
  const mode = statSync(cliPath).mode ?? 0;
  if ((mode & 0o111) === 0) {
    throw new Error(`${cliPath} is not executable after package preparation`);
  }
  return { cliPath, mode: mode & 0o777 };
}

function isEntrypoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return realpathSync(resolve(invoked)) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  try {
    const result = prepareCliBin();
    console.log(`Prepared executable Spec Validator CLI (${result.cliPath}).`);
  } catch (error) {
    console.error(
      `Could not prepare the Spec Validator CLI: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  }
}
