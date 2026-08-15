import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { diagnostic } from "../diagnostics.js";
import { relativePath } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "storybookCatalog";

const STORY_FILE_PATTERN = /\.stories\.(?:[cm]?[jt]sx?|svelte)$/;
const EXAMPLE_SOURCE_FILE_PATTERN = /\.example-sources\.[cm]?[jt]sx?$/;

function matchingFiles(directory: string, pattern: RegExp): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return matchingFiles(absolutePath, pattern);
      return entry.isFile() && pattern.test(entry.name) ? [absolutePath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function packageStoryDirectories(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.name === "stories" && path.basename(directory) === "src") {
        return [absolutePath];
      }
      return packageStoryDirectories(absolutePath);
    })
    .sort((left, right) => left.localeCompare(right));
}

function storyDirectories(context: ValidationContext): string[] {
  const options = context.config.validators.storybookCatalog;
  if (options === false) return [];
  const direct = options.roots.map((root) =>
    path.join(context.model.repoRoot, root),
  );
  const packages = options.packageRoots.flatMap((root) =>
    packageStoryDirectories(path.join(context.model.repoRoot, root)),
  );
  return [...new Set([...direct, ...packages])];
}

function parseStorySource(absolutePath: string, source: string) {
  if (!absolutePath.endsWith(".svelte")) {
    return {
      sourceFile: ts.createSourceFile(
        absolutePath,
        source,
        ts.ScriptTarget.Latest,
        true,
      ),
      lineOffset: 0,
    };
  }
  const moduleScript =
    /<script\b[^>]*(?:\bmodule\b|\bcontext=["']module["'])[^>]*>([\s\S]*?)<\/script>/.exec(
      source,
    );
  const script = moduleScript?.[1] ?? "";
  const lineOffset = moduleScript
    ? source
        .slice(0, moduleScript.index + moduleScript[0].indexOf(script))
        .split(/\r?\n/).length - 1
    : 0;
  return {
    sourceFile: ts.createSourceFile(
      absolutePath,
      script,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    ),
    lineOffset,
  };
}

function propertyName(node: ts.ObjectLiteralElementLike): string | null {
  if (!("name" in node) || !node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    return node.name.text;
  return null;
}

function objectProperty(object: ts.ObjectLiteralExpression, name: string) {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && propertyName(property) === name,
  );
}

function docsSourceObjects(root: ts.Node): ts.ObjectLiteralExpression[] {
  const sources: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const docs = objectProperty(node, "docs");
      if (docs && ts.isObjectLiteralExpression(docs.initializer)) {
        const source = objectProperty(docs.initializer, "source");
        if (source && ts.isObjectLiteralExpression(source.initializer)) {
          sources.push(source.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return sources;
}

interface TextSourceObject {
  source: string;
  start: number;
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

function textPropertyObjects(
  source: string,
  propertyName: string,
  offset = 0,
): TextSourceObject[] {
  const objects: TextSourceObject[] = [];
  const pattern = new RegExp(`\\b${propertyName}\\s*:\\s*\\{`, "g");
  for (const match of source.matchAll(pattern)) {
    const brace = (match.index ?? 0) + match[0].lastIndexOf("{");
    const end = objectEnd(source, brace);
    objects.push({ start: offset + brace, source: source.slice(brace, end) });
  }
  return objects;
}

function svelteDocsSourceObjects(source: string): TextSourceObject[] {
  return textPropertyObjects(source, "docs").flatMap((docs) =>
    textPropertyObjects(docs.source, "source", docs.start),
  );
}

function sourceFields(sourceObject: ts.ObjectLiteralExpression) {
  const code = objectProperty(sourceObject, "code");
  const language = objectProperty(sourceObject, "language");
  const type = objectProperty(sourceObject, "type");
  const validType =
    type &&
    (ts.isStringLiteral(type.initializer) ||
      ts.isNoSubstitutionTemplateLiteral(type.initializer)) &&
    type.initializer.text === "code";
  return {
    code,
    language,
    type,
    complete: Boolean(code && language && validType),
  };
}

function literalText(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function moduleCandidates(importer: string, moduleName: string): string[] {
  const base = path.resolve(path.dirname(importer), moduleName);
  return [
    base,
    `${base}.ts`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.svelte`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
    path.join(base, "index.mjs"),
  ];
}

function resolveLocalModule(
  importer: string,
  moduleName: string,
): string | null {
  if (!moduleName.startsWith(".")) return null;
  return moduleCandidates(importer, moduleName).find(existsSync) ?? null;
}

interface ImportedSource {
  imported: string;
  resolved: string | null;
}

function importModel(
  sourceFile: ts.SourceFile,
  absolutePath: string,
  storyOnlyPattern: RegExp,
) {
  const imports = new Map<string, ImportedSource>();
  const storyOnly: ts.Identifier[] = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    const resolved = resolveLocalModule(absolutePath, moduleName);
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) {
      imports.set(clause.name.text, { imported: "default", resolved });
      if (
        moduleName.startsWith(".") &&
        (storyOnlyPattern.test(clause.name.text) ||
          storyOnlyPattern.test(path.parse(moduleName).name))
      ) {
        storyOnly.push(clause.name);
      }
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        imports.set(element.name.text, {
          imported: element.propertyName?.text ?? element.name.text,
          resolved,
        });
      }
    }
  }
  return { imports, storyOnly };
}

function calledImportedHelpers(
  sourceFile: ts.SourceFile,
  imports: Map<string, ImportedSource>,
): ImportedSource[] {
  const calls: ImportedSource[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const imported = imports.get(node.expression.text);
      if (imported?.resolved) calls.push(imported);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function helperSources(
  helper: ImportedSource,
  cache: Map<
    string,
    { sourceFile: ts.SourceFile; objects: ts.ObjectLiteralExpression[] }
  >,
) {
  const key = `${helper.resolved}:${helper.imported}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const source = readFileSync(helper.resolved!, "utf8");
  const sourceFile = ts.createSourceFile(
    helper.resolved!,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let target: ts.Node = sourceFile;
  if (helper.imported !== "default") {
    const declaration = sourceFile.statements.find(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === helper.imported,
    );
    if (declaration) target = declaration;
  }
  const result = { sourceFile, objects: docsSourceObjects(target) };
  cache.set(key, result);
  return result;
}

function isAutodocsDisabled(sourceFile: ts.SourceFile): boolean {
  let disabled = false;
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) && node.text === "!autodocs") disabled = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return disabled;
}

function lineOf(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  lineOffset = 0,
): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    lineOffset +
    1
  );
}

function publiclyImported(
  code: string,
  importedName: string,
  packageName?: string,
) {
  if (!packageName) return false;
  const escape = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const name = escape(importedName);
  const pkg = escape(packageName);
  return (
    new RegExp(
      `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']${pkg}(?:/[^"']*)?["']`,
      "s",
    ).test(code) ||
    new RegExp(`import\\s+${name}\\s+from\\s*["']${pkg}(?:/[^"']*)?["']`).test(
      code,
    )
  );
}

function exposesBoundary(
  code: string,
  forbidden: RegExp,
  packageName?: string,
): boolean {
  if (!forbidden.test(code)) return false;
  if (/\bargs\s*\./.test(code)) return true;
  const names = code.match(
    /\b[A-Z][A-Za-z0-9]*(?:Demo|Harness|Fixture|Story(?:View|Surface|Frame|Control)?)\b/g,
  );
  return (
    names?.some((item) => !publiclyImported(code, item, packageName)) ?? true
  );
}

function validateSourceObjects(
  context: ValidationContext,
  objects: ts.ObjectLiteralExpression[],
  sourceFile: ts.SourceFile,
  file: string,
  findings: ReturnType<typeof diagnostic>[],
  lineOffset = 0,
) {
  const options = context.config.validators.storybookCatalog;
  if (options === false) return;
  const rule = context.config.ruleIds.storybookCatalog;
  const forbidden = new RegExp(options.forbiddenSource);
  for (const sourceObject of objects) {
    const fields = sourceFields(sourceObject);
    if (!fields.complete) {
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SOURCE-FIELDS",
          rule,
          file,
          line: lineOf(sourceFile, sourceObject, lineOffset),
          message: 'docs.source must define code, language, and type: "code"',
        }),
      );
      continue;
    }
    const code = literalText(fields.code!.initializer);
    if (code && exposesBoundary(code, forbidden, options.packageName)) {
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SOURCE-BOUNDARY",
          rule,
          file,
          line: lineOf(sourceFile, fields.code!, lineOffset),
          message:
            "Show Code must not expose a story-only demo, harness, fixture, story surface, or args expression",
        }),
      );
    }
    const language = fields.language
      ? literalText(fields.language.initializer)
      : null;
    if (language && options.plainTextLanguages.includes(language)) {
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SYNTAX-LANGUAGE",
          rule,
          file,
          line: lineOf(sourceFile, fields.language!, lineOffset),
          message: `Storybook renders language "${language}" without syntax tokens; use "tsx" for Svelte component markup`,
        }),
      );
    }
  }
}

function validateSvelteSourceObjects(
  context: ValidationContext,
  objects: TextSourceObject[],
  source: string,
  file: string,
  findings: ReturnType<typeof diagnostic>[],
) {
  const options = context.config.validators.storybookCatalog;
  if (options === false) return;
  const forbidden = new RegExp(options.forbiddenSource);
  for (const object of objects) {
    const code = /\bcode\s*:/.test(object.source);
    const language = /\blanguage\s*:\s*["']([^"']+)["']/.exec(object.source);
    const type = /\btype\s*:\s*["']code["']/.test(object.source);
    const line = source.slice(0, object.start).split(/\r?\n/).length;
    if (!code || !language || !type) {
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SOURCE-FIELDS",
          rule: context.config.ruleIds.storybookCatalog,
          file,
          line,
          message: 'docs.source must define code, language, and type: "code"',
        }),
      );
      continue;
    }
    const literalCode = /\bcode\s*:\s*(["'`])([\s\S]*?)\1/.exec(
      object.source,
    )?.[2];
    if (
      literalCode &&
      exposesBoundary(literalCode, forbidden, options.packageName)
    ) {
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SOURCE-BOUNDARY",
          rule: context.config.ruleIds.storybookCatalog,
          file,
          line,
          message:
            "Show Code must not expose a story-only demo, harness, fixture, story surface, or args expression",
        }),
      );
    }
    if (options.plainTextLanguages.includes(language[1]!)) {
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SYNTAX-LANGUAGE",
          rule: context.config.ruleIds.storybookCatalog,
          file,
          line,
          message: `Storybook renders language "${language[1]}" without syntax tokens; use "tsx" for Svelte component markup`,
        }),
      );
    }
  }
}

function validateExampleSources(
  context: ValidationContext,
  directory: string,
): ReturnType<typeof diagnostic>[] {
  const options = context.config.validators.storybookCatalog;
  if (options === false) return [];
  const findings: ReturnType<typeof diagnostic>[] = [];
  const forbidden = new RegExp(options.forbiddenSource);
  for (const absolutePath of matchingFiles(
    directory,
    EXAMPLE_SOURCE_FILE_PATTERN,
  )) {
    const source = readFileSync(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(
      absolutePath,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    const relative = relativePath(context.model.repoRoot, absolutePath);
    const report = (node: ts.Node, code: string) => {
      if (!exposesBoundary(code, forbidden, options.packageName)) return;
      findings.push(
        diagnostic({
          code: "SPEC-STORY-SOURCE-BOUNDARY",
          rule: context.config.ruleIds.storybookCatalog,
          file: relative,
          line: lineOf(sourceFile, node),
          message:
            "Show Code must not expose a story-only demo, harness, fixture, story surface, or args expression",
        }),
      );
    };
    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.endsWith("?raw")
      ) {
        const target = resolveLocalModule(
          absolutePath,
          node.moduleSpecifier.text.slice(0, -4),
        );
        if (target) report(node.moduleSpecifier, readFileSync(target, "utf8"));
        return;
      }
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)) &&
        !ts.isImportDeclaration(node.parent)
      ) {
        report(node, node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return findings;
}

function validateMdxLanguages(
  context: ValidationContext,
  directory: string,
): ReturnType<typeof diagnostic>[] {
  const options = context.config.validators.storybookCatalog;
  if (options === false || !options.plainTextLanguages.length) return [];
  const findings: ReturnType<typeof diagnostic>[] = [];
  const alternatives = options.plainTextLanguages
    .map((language) => language.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const patterns = [
    new RegExp(`\\blanguage\\s*=\\s*["'](${alternatives})["']`, "g"),
    new RegExp("^```(" + alternatives + ")\\s*$", "gm"),
  ];
  for (const absolutePath of matchingFiles(directory, /\.mdx$/)) {
    const source = readFileSync(absolutePath, "utf8");
    const relative = relativePath(context.model.repoRoot, absolutePath);
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        findings.push(
          diagnostic({
            code: "SPEC-STORY-SYNTAX-LANGUAGE",
            rule: context.config.ruleIds.storybookCatalog,
            file: relative,
            line: source.slice(0, match.index ?? 0).split(/\r?\n/).length,
            message: `Storybook renders language "${match[1]}" without syntax tokens; use "tsx" for Svelte component markup`,
          }),
        );
      }
    }
  }
  return findings;
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.storybookCatalog;
  if (options === false) return [];
  const findings: ReturnType<typeof diagnostic>[] = [];
  const helperCache = new Map<
    string,
    { sourceFile: ts.SourceFile; objects: ts.ObjectLiteralExpression[] }
  >();
  const validatedHelpers = new Set<string>();
  const directories = storyDirectories(context);

  for (const directory of directories) {
    findings.push(...validateExampleSources(context, directory));
    findings.push(...validateMdxLanguages(context, directory));
  }

  const storyOnlyPattern = new RegExp(options.storyOnlyName, "i");
  for (const absolutePath of directories.flatMap((directory) =>
    matchingFiles(directory, STORY_FILE_PATTERN),
  )) {
    const source = readFileSync(absolutePath, "utf8");
    const { sourceFile, lineOffset } = parseStorySource(absolutePath, source);
    const { imports, storyOnly } = importModel(
      sourceFile,
      absolutePath,
      storyOnlyPattern,
    );
    if (!storyOnly.length || isAutodocsDisabled(sourceFile)) continue;

    const relative = relativePath(context.model.repoRoot, absolutePath);
    const localSources = docsSourceObjects(sourceFile);
    const svelteSources = absolutePath.endsWith(".svelte")
      ? svelteDocsSourceObjects(source)
      : [];
    const importedSources = calledImportedHelpers(sourceFile, imports).flatMap(
      (helper) => {
        const parsed = helperSources(helper, helperCache);
        const helperKey = `${helper.resolved}:${helper.imported}`;
        if (!validatedHelpers.has(helperKey)) {
          validatedHelpers.add(helperKey);
          validateSourceObjects(
            context,
            parsed.objects,
            parsed.sourceFile,
            relativePath(context.model.repoRoot, helper.resolved!),
            findings,
          );
        }
        return parsed.objects;
      },
    );

    if (absolutePath.endsWith(".svelte")) {
      validateSvelteSourceObjects(
        context,
        svelteSources,
        source,
        relative,
        findings,
      );
    } else {
      validateSourceObjects(
        context,
        localSources,
        sourceFile,
        relative,
        findings,
        lineOffset,
      );
    }
    if (localSources.length || svelteSources.length || importedSources.length)
      continue;
    findings.push(
      diagnostic({
        code: "SPEC-STORY-SOURCE-MISSING",
        rule: context.config.ruleIds.storybookCatalog,
        file: relative,
        line: lineOf(sourceFile, storyOnly[0]!, lineOffset),
        message:
          "Autodocs story uses a local story-only render boundary without explicit consumer source",
      }),
    );
  }
  return findings;
}
