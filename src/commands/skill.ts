import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { UsageError } from "../argv.js";
import type { Reporter } from "../reporter.js";

export function skillSourcePath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../skill/spec-validator/SKILL.md",
  );
}

export function globalSkillPath(home = os.homedir()): string {
  return path.join(home, ".agents", "skills", "spec-validator", "SKILL.md");
}

export function installSkill(home = os.homedir()): string {
  const source = skillSourcePath();
  if (!existsSync(source)) {
    throw new Error(`shipped skill is missing at ${source}`);
  }
  const destination = globalSkillPath(home);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return destination;
}

export function skillCommand(
  _repoRoot: string,
  argv: string[],
  reporter: Reporter,
): number {
  if (argv.length !== 1 || argv[0] !== "install") {
    throw new UsageError("Usage: spec-validator skill install");
  }
  const destination = installSkill();
  reporter.writeReport({
    version: 1,
    ok: true,
    exitCode: 0,
    message: `Installed skill to ${destination}`,
  });
  return 0;
}
