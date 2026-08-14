#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import path from "node:path";

import { parseGlobalArgv, usage, UsageError } from "./argv.js";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { doctorCommand } from "./commands/doctor.js";
import { firstCommand } from "./commands/first.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { searchCommand } from "./commands/search.js";
import { skillCommand } from "./commands/skill.js";
import { validateCommand } from "./commands/validate.js";
import { createReporter } from "./reporter.js";

export async function runCli(
  argv = process.argv.slice(2),
  repoRoot = process.cwd(),
): Promise<number> {
  const parsed = parseGlobalArgv(argv);
  const reporter = createReporter(parsed.output);
  if (parsed.help || !parsed.command) {
    reporter.writeLine(usage());
    return parsed.help ? 0 : 1;
  }
  try {
    switch (parsed.command) {
      case "validate":
        return await validateCommand(repoRoot, parsed.rest, reporter);
      case "check":
        return await checkCommand(repoRoot, parsed.rest, reporter);
      case "build":
        return buildCommand(repoRoot, parsed.rest, reporter, "build");
      case "serve":
        return buildCommand(repoRoot, parsed.rest, reporter, "serve");
      case "first":
        return await firstCommand(repoRoot, parsed.rest, reporter);
      case "search":
        return await searchCommand(repoRoot, parsed.rest, reporter, "search");
      case "index":
        return await searchCommand(repoRoot, parsed.rest, reporter, "index");
      case "list":
        return await listCommand(repoRoot, parsed.rest, reporter);
      case "init":
        return initCommand(repoRoot, parsed.rest, reporter);
      case "doctor":
        return await doctorCommand(repoRoot, parsed.rest, reporter);
      case "skill":
        return skillCommand(repoRoot, parsed.rest, reporter);
      default:
        reporter.writeError(`Unknown command: ${parsed.command}`);
        reporter.writeError(usage());
        return 2;
    }
  } catch (error) {
    if (error instanceof UsageError) {
      reporter.writeError(error.message);
      reporter.writeError(usage());
      return 2;
    }
    reporter.writeError(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
