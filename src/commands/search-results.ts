import { path } from "../platform/current.js";
export interface ScopedSearchResult {
  file: string;
  line?: number;
  title?: string;
  snippet?: string;
  [key: string]: unknown;
}
export function scopedSearchResults(
  root: string,
  source: string,
  collection: string,
  results: unknown,
): ScopedSearchResult[] {
  if (!Array.isArray(results))
    throw new Error("QMD scoped results must be an array");
  return results.map((row) => {
    if (!row || typeof row.file !== "string")
      throw new Error("QMD result has no source file");
    const prefix = `qmd://${collection}/`;
    const file = row.file.startsWith(prefix)
      ? path.resolve(root, source, row.file.slice(prefix.length))
      : path.resolve(root, row.file);
    const relative = path.relative(path.resolve(root, source), file);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.resolve(root, source, relative) !== file
    )
      throw new Error(
        `QMD result outside the selected source root: ${row.file}`,
      );
    return { ...row, file };
  });
}
