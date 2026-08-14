import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { diagnostic } from "../diagnostics.js";
import { relativePath } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "storybookCatalog";

const STORY_FILE_PATTERN = /\.stories\.(?:svelte|[cm]?[jt]sx?)$/;
const MDX_FILE_PATTERN = /\.mdx$/;
const EXAMPLE_SOURCE_FILE_PATTERN = /\.example-sources\.[cm]?[jt]sx?$/;
const PLAIN_TEXT_LANGUAGE_PATTERN = /^(?:html|markup|svelte)$/;
const STORY_ONLY_NAME_PATTERN =
  /(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?)$/;
const STORY_ONLY_MODULE_PATTERN = /(?:demo|harness|fixture|\.story)(?:\.[^/]+)?$/i;
const FORBIDDEN_SOURCE_PATTERN =
  /\b(?:[A-Z][A-Za-z0-9]*(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?))\b|\bargs\s*\./;

function publiclyImported(code: string, importedName: string, packageName?: string) {
  if (!packageName) return false;
  const escapedName = importedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPackage = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namedImport = new RegExp(
    `import\\s*\\{[^}]*\\b${escapedName}\\b[^}]*\\}\\s*from\\s*["']${escapedPackage}(?:/[^"']*)?["']`,
    "s",
  );
  const defaultImport = new RegExp(
    `import\\s+${escapedName}\\s+from\\s*["']${escapedPackage}(?:/[^"']*)?["']`,
  );
  return namedImport.test(code) || defaultImport.test(code);
}

function exposesStoryBoundary(code: string, packageName?: string) {
  if (/\bargs\s*\./.test(code)) return true;
  const names = code.match(
    /\b[A-Z][A-Za-z0-9]*(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?)\b/g,
  );
  return names?.some((item) => !publiclyImported(code, item, packageName)) ?? false;
}

function files(directory: string, pattern: RegExp): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return files(absolutePath, pattern);
      return entry.isFile() && pattern.test(entry.name) ? [absolutePath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function objectEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return source.length;
}

function propertyObjects(source: string, propertyName: string, offset = 0) {
  const objects: Array<{ start: number; source: string }> = [];
  const pattern = new RegExp(`\\b${propertyName}\\s*:\\s*\\{`, "g");
  for (const match of source.matchAll(pattern)) {
    const brace = match.index + match[0].lastIndexOf("{");
    const end = objectEnd(source, brace);
    objects.push({ start: offset + brace, source: source.slice(brace, end) });
  }
  return objects;
}

function docsSourceObjects(source: string) {
  return propertyObjects(source, "docs").flatMap((docs) =>
    propertyObjects(docs.source, "source", docs.start),
  );
}

function localDefaultImports(source: string) {
  const imports: Array<{ name: string; moduleName: string; index: number }> = [];
  const pattern =
    /\bimport\s+(?!type\b)([A-Za-z_$][\w$]*)[^;\n]*?\s+from\s+["'](\.[^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    imports.push({ name: match[1]!, moduleName: match[2]!, index: match.index });
  }
  return imports;
}

function isStoryOnlyBoundary(imported: { name: string; moduleName: string }) {
  return (
    STORY_ONLY_NAME_PATTERN.test(imported.name) ||
    STORY_ONLY_MODULE_PATTERN.test(path.basename(imported.moduleName))
  );
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.storybookCatalog;
  if (options === false) return [];
  const findings = [];
  const catalogRule = context.config.ruleIds.storybookCatalog;
  const repoRoot = context.model.repoRoot;

  for (const root of options.roots) {
    const sourceRoot = path.join(repoRoot, root);
    for (const absolutePath of files(sourceRoot, EXAMPLE_SOURCE_FILE_PATTERN)) {
      const source = readFileSync(absolutePath, "utf8");
      const sourceFile = ts.createSourceFile(
        absolutePath,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const relative = relativePath(repoRoot, absolutePath);
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          FORBIDDEN_SOURCE_PATTERN.test(node.text) &&
          exposesStoryBoundary(node.text, options.packageName)
        ) {
          findings.push(
            diagnostic({
              code: "SPEC-STORY-SOURCE-BOUNDARY",
              rule: catalogRule,
              file: relative,
              line:
                sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
                  .line + 1,
              message:
                "Show Code must not expose a story-only demo, harness, fixture, story surface, or args expression",
            }),
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    for (const absolutePath of files(sourceRoot, MDX_FILE_PATTERN)) {
      const source = readFileSync(absolutePath, "utf8");
      const relative = relativePath(repoRoot, absolutePath);
      for (const pattern of [
        /\blanguage\s*=\s*["'](html|markup|svelte)["']/g,
        /^```(html|markup|svelte)\s*$/gm,
      ]) {
        for (const match of source.matchAll(pattern)) {
          findings.push(
            diagnostic({
              code: "SPEC-STORY-SYNTAX-LANGUAGE",
              rule: catalogRule,
              file: relative,
              line: lineOf(source, match.index ?? 0),
              message: `Storybook renders language "${match[1]}" without syntax tokens; use "tsx" for Svelte component markup`,
            }),
          );
        }
      }
    }

    for (const absolutePath of files(sourceRoot, STORY_FILE_PATTERN)) {
      const source = readFileSync(absolutePath, "utf8");
      const relative = relativePath(repoRoot, absolutePath);
      if (source.includes('"!autodocs"') || source.includes("'!autodocs'")) continue;
      const sourceObjects = docsSourceObjects(source);
      const storyOnly = localDefaultImports(source).filter(isStoryOnlyBoundary);
      if (!storyOnly.length) continue;
      for (const sourceObject of sourceObjects) {
        if (
          !/\bcode\s*:/.test(sourceObject.source) ||
          !/\blanguage\s*:/.test(sourceObject.source) ||
          !/\btype\s*:\s*["']code["']/.test(sourceObject.source)
        ) {
          findings.push(
            diagnostic({
              code: "SPEC-STORY-SOURCE-FIELDS",
              rule: catalogRule,
              file: relative,
              line: lineOf(source, sourceObject.start),
              message: 'docs.source must define code, language, and type: "code"',
            }),
          );
        }
      }
      if (sourceObjects.length) continue;
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SOURCE-MISSING",
          rule: catalogRule,
          file: relative,
          line: lineOf(source, storyOnly[0]!.index),
          message:
            "Autodocs story uses a local story-only render boundary without explicit consumer source",
        }),
      );
    }
  }
  return findings;
}
