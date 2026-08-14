import { spawnSync } from "node:child_process";

import { loadResolvedConfig } from "../config.js";
import type { Reporter } from "../reporter.js";
import { firstCommand } from "./first.js";
import { validateCommand } from "./validate.js";

function runLane(
  label: string,
  command: string,
  args: string[],
  repoRoot: string,
  reporter: Reporter,
  useShell = process.platform === "win32",
): number {
  if (!reporter.json) reporter.writeLine(`${label}...`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: reporter.json ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: useShell,
  });
  const status = result.status ?? 1;
  if (!reporter.json) {
    reporter.writeLine(status === 0 ? `${label} passed.` : `${label} failed.`);
  }
  return status;
}

export async function checkCommand(
  repoRoot: string,
  argv: string[],
  reporter: Reporter,
): Promise<number> {
  if (!reporter.json) reporter.writeLine("validate...");
  const validateStatus = await validateCommand(repoRoot, argv, reporter);
  if (validateStatus !== 0) return validateStatus;
  if (!reporter.json) reporter.writeLine("validate passed.");

  const config = await loadResolvedConfig(repoRoot);
  if (config.check.tests) {
    const command = config.check.tests === true ? "pnpm test" : config.check.tests;
    const [bin, ...args] = command.split(/\s+/);
    const testStatus = runLane("tests", bin!, args, repoRoot, reporter);
    if (testStatus !== 0) return testStatus;
  }

  const buildStatus = runLane("mdbook", "mdbook", ["build", "./spec"], repoRoot, reporter);
  if (buildStatus !== 0) return buildStatus;

  if (!reporter.json) reporter.writeLine("spec-first...");
  const firstStatus = await firstCommand(repoRoot, argv, reporter);
  return firstStatus;
}
