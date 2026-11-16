import { markdownFiles, toPosix } from "../model.js";
import { existsSync, path } from "../platform/current.js";
import type { DoctorCheck, ResolvedConfig } from "../types.js";

export function canonicalFileChecks(
  repoRoot: string,
  config: ResolvedConfig,
): DoctorCheck[] {
  const summary = `${config.specDir}/SUMMARY.md`;
  const present = existsSync(path.join(repoRoot, summary));
  const checks: DoctorCheck[] = [
    {
      name: summary,
      status: present ? "pass" : "fail",
      message: present ? "present" : "missing canonical chapter",
    },
  ];
  const options = config.validators.verification;
  if (options === false) return checks;
  const directory = path.join(repoRoot, config.specDir);
  const selected = markdownFiles(directory)
    .map((file) => toPosix(path.relative(directory, file)))
    .filter((chapter) =>
      options.files.length
        ? options.files.some((pattern) => new RegExp(pattern).test(chapter))
        : chapter === options.file,
    );
  if (!selected.length) {
    checks.push({
      name: options.files.length
        ? `${config.specDir} (verification)`
        : `${config.specDir}/${options.file}`,
      status: "fail",
      message: options.files.length
        ? `verification selection is empty; restore the configured matrices matching ${options.files.join(", ")}`
        : "missing canonical chapter",
    });
  } else {
    checks.push(
      ...selected.map((file): DoctorCheck => ({
        name: `${config.specDir}/${file}`,
        status: "pass",
        message: "present",
      })),
    );
  }
  return checks;
}
