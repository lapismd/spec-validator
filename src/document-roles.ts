import type { ResolvedConfig, SpecFile } from "./types.js";
export function documentRole(file: SpecFile, config: ResolvedConfig): string {
  const matched = config.documentRoles.find((rule) =>
    new RegExp(rule.pattern).test(file.chapterPath),
  );
  if (matched) return matched.role;
  if (file.chapterPath === "SUMMARY.md") return "navigation";
  const verification = config.validators.verification;
  if (
    verification &&
    (verification.files.length
      ? verification.files.some((pattern) =>
          new RegExp(pattern).test(file.chapterPath),
        )
      : file.chapterPath === verification.file)
  )
    return "verification";
  return file.chapterPath === "verification.md" ? "verification" : "contract";
}
