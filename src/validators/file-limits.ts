import { diagnostic } from "../diagnostics.js";
import type { ValidationContext } from "../types.js";
export const name = "fileLimits";
export function validate(context: ValidationContext) {
  const options = context.config.validators.fileLimits;
  if (!options) return [];
  if (
    ![options.maxLines, options.maxBytes].every(
      (n) => Number.isInteger(n) && n > 0,
    )
  )
    throw new Error("fileLimits requires positive integer limits");
  return context.model.files.flatMap((file) => {
    const lines =
      file.source.split(/\r?\n/).length - (file.source.endsWith("\n") ? 1 : 0);
    const bytes = new TextEncoder().encode(file.source).length;
    return [
      ["SPEC-FILE-LINES", lines, options.maxLines, "physical lines"],
      ["SPEC-FILE-BYTES", bytes, options.maxBytes, "UTF-8 bytes"],
    ].flatMap(([code, actual, maximum, unit]) =>
      Number(actual) > Number(maximum)
        ? [
            diagnostic({
              code: String(code),
              rule: context.config.ruleIds.fileLimits,
              file: file.relativePath,
              line: 1,
              message: `${actual} ${unit} exceeds ${maximum}; split this document at a topic or evidence boundary`,
            }),
          ]
        : [],
    );
  });
}
