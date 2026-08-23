import { createSpecModel } from "./model.js";
import { readFileSync } from "./platform/current.js";
import { discoverTrackedFiles } from "./tracked-files.js";
import type { ResolvedConfig, ValidationContext } from "./types.js";

export function createValidationContext({
  repoRoot,
  config,
  trackedFiles,
}: {
  repoRoot: string;
  config: ResolvedConfig;
  trackedFiles?: string[];
}): ValidationContext {
  const model = createSpecModel(repoRoot, config);
  return {
    model,
    trackedFiles: trackedFiles ?? discoverTrackedFiles(repoRoot),
    config,
    readOptional(filePath: string) {
      try {
        return readFileSync(filePath, "utf8");
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return null;
        throw error;
      }
    },
  };
}
