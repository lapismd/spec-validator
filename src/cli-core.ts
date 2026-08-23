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
import { runtime } from "./platform/current.js";
import { createReporter } from "./reporter.js";

export async function runCli(
  argv = runtime.args,
  repoRoot = runtime.cwd(),
): Promise<number> {
  const parsed = parseGlobalArgv(argv);
  const reporter = createReporter(parsed.output);
  if (parsed.help || !parsed.command) {
    const exitCode = parsed.help ? 0 : 2;
    if (reporter.json) {
      reporter.writeReport({
        version: 1,
        ok: parsed.help,
        exitCode,
        message: usage(),
      });
    } else {
      reporter.writeLine(usage());
    }
    return exitCode;
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
        if (reporter.json) {
          reporter.writeReport({
            version: 1,
            ok: false,
            exitCode: 2,
            message: `Unknown command: ${parsed.command}\n${usage()}`,
          });
        } else {
          reporter.writeError(`Unknown command: ${parsed.command}`);
          reporter.writeError(usage());
        }
        return 2;
    }
  } catch (error) {
    if (error instanceof UsageError) {
      if (reporter.json) {
        reporter.writeReport({
          version: 1,
          ok: false,
          exitCode: 2,
          message: `${error.message}\n${usage()}`,
        });
      } else {
        reporter.writeError(error.message);
        reporter.writeError(usage());
      }
      return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (reporter.json) {
      reporter.writeReport({ version: 1, ok: false, exitCode: 2, message });
    } else {
      reporter.writeError(message);
    }
    return 2;
  }
}
