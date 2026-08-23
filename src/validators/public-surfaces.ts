import { diagnostic } from "../diagnostics.js";
import { relativePath } from "../model.js";
import {
  existsSync,
  path,
  readdirSync,
  readFileSync,
} from "../platform/current.js";
import type { Diagnostic, ValidationContext } from "../types.js";

export const name = "publicSurfaces";

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolutePath);
      return entry.isFile() &&
        /(?:\.stories\.(?:svelte|[cm]?[jt]sx?)|\.mdx)$/.test(entry.name)
        ? [absolutePath]
        : [];
    })
    .sort();
}

function discoverCatalogTitles(repoRoot: string, roots: string[]): string[] {
  const titles: string[] = [];
  for (const root of roots) {
    for (const absolutePath of sourceFiles(path.join(repoRoot, root))) {
      if (relativePath(repoRoot, absolutePath).startsWith("src/spec/")) {
        continue;
      }
      const source = readFileSync(absolutePath, "utf8");
      const match =
        /defineMeta(?:<[^>]+>)?\s*\(\s*\{[\s\S]*?\btitle\s*:\s*["'`]([^"'`]+)["'`]/.exec(
          source,
        ) ?? /<Meta\s+[^>]*title=["']([^"']+)["']/.exec(source);
      if (match) titles.push(match[1]!);
    }
  }
  return [...new Set(titles)].sort();
}

function duplicates(values: string[]): string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.publicSurfaces;
  if (options === false) return [];
  const rule = context.config.ruleIds.publicSurfaces;
  const mapPath = options.map;
  const absolutePath = path.join(context.model.repoRoot, mapPath);
  if (!existsSync(absolutePath)) {
    return [
      diagnostic({
        code: "SPEC-SURFACE-MAP-MISSING",
        rule,
        file: mapPath,
        message: "public export and catalog mapping is missing",
      }),
    ];
  }
  const map = JSON.parse(readFileSync(absolutePath, "utf8")) as {
    exports?: Array<{ name: string; requirement: string }>;
    catalog?: Array<{ name: string; requirement: string }>;
  };
  const packageJson = JSON.parse(
    readFileSync(path.join(context.model.repoRoot, "package.json"), "utf8"),
  ) as { exports?: Record<string, unknown> };
  const exports = Object.keys(packageJson.exports ?? {}).sort();
  const catalog = discoverCatalogTitles(context.model.repoRoot, options.roots);
  const findings: Diagnostic[] = [];

  const validateMapping = (
    kind: string,
    actual: string[],
    mappings: Array<{ name: string; requirement: string }>,
  ) => {
    const keys = mappings.map((entry) => entry.name);
    for (const duplicate of duplicates(keys)) {
      findings.push(
        diagnostic({
          code: "SPEC-SURFACE-DUPLICATE",
          rule,
          file: mapPath,
          subject: duplicate,
          message: `${kind} surface is mapped more than once; retain one requirement mapping`,
        }),
      );
    }
    for (const name of actual) {
      const matches = mappings.filter((entry) => entry.name === name);
      if (matches.length !== 1) {
        findings.push(
          diagnostic({
            code: "SPEC-SURFACE-UNMAPPED",
            rule,
            file: mapPath,
            subject: name,
            message: `current ${kind} surface has ${matches.length} mappings; add exactly one`,
          }),
        );
      }
    }
    for (const mapping of mappings) {
      if (!actual.includes(mapping.name)) {
        findings.push(
          diagnostic({
            code: "SPEC-SURFACE-STALE",
            rule,
            file: mapPath,
            subject: mapping.name,
            message: `mapped ${kind} surface no longer exists; remove or update it`,
          }),
        );
      }
      if (!context.model.definitionsById.has(mapping.requirement)) {
        findings.push(
          diagnostic({
            code: "SPEC-SURFACE-REQUIREMENT",
            rule,
            file: mapPath,
            subject: mapping.requirement,
            message: `${kind} mapping references an unknown requirement`,
          }),
        );
      }
      if (options.requireCoverage) {
        const coverage =
          context.model.coverageById.get(mapping.requirement) ?? [];
        if (coverage.length !== 1) {
          findings.push(
            diagnostic({
              code: "SPEC-SURFACE-COVERAGE",
              rule,
              file: mapPath,
              subject: mapping.requirement,
              message: `mapped ${kind} requirement has ${coverage.length} public-surface coverage rows; add exactly one`,
            }),
          );
        }
      }
    }
  };

  validateMapping("export", exports, map.exports ?? []);
  validateMapping("catalog", catalog, map.catalog ?? []);
  return findings;
}
