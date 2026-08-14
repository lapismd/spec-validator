import { loadResolvedConfig } from "../config.js";
import type { Reporter } from "../reporter.js";
import { BUILTIN_VALIDATOR_NAMES } from "../validators/index.js";

export async function listCommand(
  repoRoot: string,
  _argv: string[],
  reporter: Reporter,
): Promise<number> {
  const config = await loadResolvedConfig(repoRoot);
  const validators = BUILTIN_VALIDATOR_NAMES.map((name) => ({
    name,
    enabled: config.validators[name as keyof typeof config.validators] !== false,
    options: config.validators[name as keyof typeof config.validators],
  }));
  if (reporter.json) {
    reporter.writeReport({
      version: 1,
      ok: true,
      exitCode: 0,
      stats: { validators: validators.filter((item) => item.enabled).length },
      message: JSON.stringify({ preset: config.preset, validators }, null, 2),
    });
    return 0;
  }
  reporter.writeLine(`Preset: ${config.preset}`);
  for (const item of validators) {
    const state = item.enabled ? "on" : "off";
    reporter.writeLine(`  ${state.padEnd(3)} ${item.name}`);
  }
  if (config.plugins.length) {
    reporter.writeLine("Plugins:");
    for (const plugin of config.plugins) reporter.writeLine(`  ${plugin}`);
  }
  return 0;
}
