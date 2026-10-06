/**
 * Counted-line limits, file kinds, and generic dump-name conventions for
 * SV-ARCH-008 and SV-ARCH-009.
 *
 * spec-validator claims no import-direction layer matrix: `spec/src/architecture.md`
 * describes public surfaces rather than layers, so this policy owns size and
 * naming only.
 */

export type FileKind = "production" | "test" | "script";

export const LIMIT_KEYS: Record<FileKind, string> = {
  production: "newProductionCountedLines",
  test: "newTestCountedLines",
  script: "newScriptCountedLines",
};

export const DEFAULT_LIMITS: Record<string, number> = {
  newProductionCountedLines: 300,
  newTestCountedLines: 500,
  newScriptCountedLines: 300,
};

export const DUMP_NAMES = new Set(["utils", "helpers", "common", "services"]);

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/u;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const TEST_SPECIFIER = /\.(?:test|spec)(?:\.[cm]?[jt]sx?)?$/u;
const SCRIPT_ROOTS = ["scripts/", "tests/"];

export function isSourceFile(name: string): boolean {
  return SOURCE_EXT.test(name);
}

export function toPosix(relativePath: string): string {
  return relativePath.split("\\").join("/");
}

export function fileKind(posixPath: string): FileKind {
  if (TEST_FILE.test(posixPath)) return "test";
  if (SCRIPT_ROOTS.some((root) => posixPath.startsWith(root))) return "script";
  return "production";
}

export function isDumpPath(posixPath: string): boolean {
  const parts = posixPath.split("/");
  const base = (parts.at(-1) ?? "").replace(SOURCE_EXT, "");
  if (DUMP_NAMES.has(base)) return true;
  return parts.slice(0, -1).some((part) => DUMP_NAMES.has(part));
}

export function isTestSpecifier(specifier: string): boolean {
  return TEST_SPECIFIER.test(specifier);
}
