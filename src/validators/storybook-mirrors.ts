import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { diagnostic } from "../diagnostics.js";
import { relativePath, toPosix } from "../model.js";
import type { ValidationContext } from "../types.js";

export const name = "storybookMirrors";

function summaryEntries(context: ValidationContext, includeAllLinks: boolean) {
  const summary = context.model.files.find(
    (file) => file.chapterPath === "SUMMARY.md",
  );
  if (!summary) return [];
  return summary.source.split(/\r?\n/).flatMap((line, index) => {
    const pattern = includeAllLinks
      ? /\[([^\]]+)]\(([^)#]+\.md)(?:#[^)]+)?\)/g
      : /^\s*-\s+\[([^\]]+)]\(([^)#]+\.md)(?:#[^)]+)?\)\s*$/g;
    return [...line.matchAll(pattern)].map((match) => ({
      label: match[1]!.replaceAll(" / ", "/"),
      chapterPath: toPosix(path.normalize(match[2]!)),
      line: index + 1,
    }));
  });
}

function collectMdx(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const entries: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...collectMdx(absolutePath));
    else if (entry.isFile() && entry.name.endsWith(".mdx"))
      entries.push(absolutePath);
  }
  return entries.sort();
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

function flattenOrder(
  array: ts.ArrayLiteralExpression,
  prefix: string[] = [],
): string[] {
  const titles: string[] = [];
  for (let index = 0; index < array.elements.length; index += 1) {
    const element = array.elements[index]!;
    if (!ts.isStringLiteral(element)) continue;
    const label = element.text;
    const children = array.elements[index + 1];
    if (children && ts.isArrayLiteralExpression(children)) {
      titles.push(...flattenOrder(children, [...prefix, label]));
      index += 1;
    } else if (label !== "*") {
      titles.push([...prefix, label].join("/"));
    }
  }
  return titles;
}

function parseInlineStoryOrder(
  source: string,
  fileName: string,
): string[] | null {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let result: string[] | null = null;
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node) === "storySort" &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const order = objectProperty(node.initializer, "order");
      if (order && ts.isArrayLiteralExpression(order.initializer)) {
        result = flattenOrder(order.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

function validateRegistry(
  context: ValidationContext,
  entries: ReturnType<typeof summaryEntries>,
) {
  const options = context.config.validators.storybookMirrors;
  if (options === false || !options.registryPath) return [];
  const rule = context.config.ruleIds.storybookMirrors;
  const absolute = path.join(context.model.repoRoot, options.registryPath);
  if (!existsSync(absolute)) {
    return [
      diagnostic({
        code: "SPEC-MIRROR-REGISTRY",
        rule,
        file: options.registryPath,
        message: "configured Storybook specification registry is missing",
      }),
    ];
  }
  const source = readFileSync(absolute, "utf8");
  return entries.flatMap((entry) => {
    const needle = options.registryEntryTemplate.replace(
      "<chapter>",
      entry.chapterPath,
    );
    const count = source.split(needle).length - 1;
    return count === 1
      ? []
      : [
          diagnostic({
            code: "SPEC-MIRROR-REGISTRY",
            rule,
            file: options.registryPath!,
            subject: entry.chapterPath,
            message: `expected one registry entry, found ${count}`,
          }),
        ];
  });
}

export function validate(context: ValidationContext) {
  const options = context.config.validators.storybookMirrors;
  if (options === false) return [];
  const rule = context.config.ruleIds.storybookMirrors;
  const findings: ReturnType<typeof diagnostic>[] = [];
  const entries = summaryEntries(context, options.style === "stories-spec");
  const root = path.join(context.model.repoRoot, options.directory);
  const actual = collectMdx(root);

  if (!existsSync(root)) {
    return [
      diagnostic({
        code: "SPEC-MIRROR-MISSING",
        rule,
        file: options.directory,
        message:
          "configured Storybook specification mirror directory is missing",
      }),
    ];
  }

  if (options.style === "stories-spec") {
    const mirrors: Array<{ chapter: string; file: string }> = [];
    for (const file of actual) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /import\s+\w+\s+from\s+["'][^"']*spec\/src\/([^"']+\.md)\?raw["']/g,
      )) {
        mirrors.push({
          chapter: toPosix(path.normalize(match[1]!)),
          file: relativePath(context.model.repoRoot, file),
        });
      }
    }
    for (const entry of entries) {
      const matching = mirrors.filter(
        (mirror) => mirror.chapter === entry.chapterPath,
      );
      if (matching.length !== 1) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-MISSING",
            rule,
            file: `${context.config.specDir}/${entry.chapterPath}`,
            subject: entry.chapterPath,
            message: `expected one Storybook mirror, found ${matching.length}`,
          }),
        );
      }
    }
    for (const mirror of mirrors) {
      if (!entries.some((entry) => entry.chapterPath === mirror.chapter)) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-STALE",
            rule,
            file: mirror.file,
            subject: mirror.chapter,
            message: "Storybook specification mirror has no SUMMARY chapter",
          }),
        );
      }
    }
    findings.push(...validateRegistry(context, entries));
    return findings;
  }

  const expected = new Map(
    entries.map((entry) => [
      path.resolve(path.join(root, entry.chapterPath.replace(/\.md$/, ".mdx"))),
      entry,
    ]),
  );
  for (const [absolutePath, entry] of expected) {
    const relative = relativePath(context.model.repoRoot, absolutePath);
    if (!existsSync(absolutePath)) {
      findings.push(
        diagnostic({
          code: "SPEC-MIRROR-MISSING",
          rule,
          file: relative,
          subject: entry.chapterPath,
          message:
            "add the metadata-only Storybook mirror for this SUMMARY chapter",
        }),
      );
      continue;
    }
    const source = readFileSync(absolutePath, "utf8");
    const rawImport = /import\s+content\s+from\s+["']([^"']+)\?raw["'];?/.exec(
      source,
    );
    const expectedTitle = `${options.titlePrefix}/${entry.label}`;
    if (!rawImport) {
      findings.push(
        diagnostic({
          code: "SPEC-MIRROR-IMPORT",
          rule,
          file: relative,
          message: "mirror must import its canonical Markdown as raw content",
        }),
      );
    } else if (options.verifyTarget) {
      const target = path.resolve(path.dirname(absolutePath), rawImport[1]!);
      const expectedTarget = path.resolve(
        context.model.sourceDirectory,
        entry.chapterPath,
      );
      if (target !== expectedTarget) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-TARGET",
            rule,
            file: relative,
            subject: entry.chapterPath,
            message:
              "raw import does not resolve to the matching canonical chapter",
          }),
        );
      }
    }
    if (options.verifyTitle) {
      const title = /<Meta\s+title=["']([^"']+)["']\s*\/>/.exec(source);
      if (title?.[1] !== expectedTitle) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-TITLE",
            rule,
            file: relative,
            subject: expectedTitle,
            message: "Storybook title must match SUMMARY hierarchy and label",
          }),
        );
      }
    }
    if (options.verifyContent) {
      const body = source
        .replace(
          /^import\s+\{\s*Markdown,\s*Meta\s*\}\s+from\s+["']@storybook\/addon-docs\/blocks["'];?\s*$/m,
          "",
        )
        .replace(/^import\s+content\s+from\s+["'][^"']+\?raw["'];?\s*$/m, "")
        .trim();
      const expectedBody = `<Meta title="${expectedTitle}" />\n\n<Markdown>{content}</Markdown>`;
      if (body !== expectedBody) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-CONTENT",
            rule,
            file: relative,
            message:
              "mirror may contain only metadata, the raw canonical import, and the Markdown renderer",
          }),
        );
      }
    }
  }
  for (const absolutePath of actual) {
    if (expected.has(path.resolve(absolutePath))) continue;
    findings.push(
      diagnostic({
        code: "SPEC-MIRROR-STALE",
        rule,
        file: relativePath(context.model.repoRoot, absolutePath),
        message: "Storybook specification mirror has no SUMMARY chapter",
      }),
    );
  }
  if (options.verifyOrder) {
    const previewPath = path.join(context.model.repoRoot, options.previewPath);
    const preview = existsSync(previewPath)
      ? readFileSync(previewPath, "utf8")
      : "";
    const order = parseInlineStoryOrder(preview, previewPath);
    const expectedOrder = entries.map(
      (entry) => `${options.titlePrefix}/${entry.label}`,
    );
    if (!order) {
      findings.push(
        diagnostic({
          code: "SPEC-MIRROR-SORT",
          rule,
          file: options.previewPath,
          message: "configure an inline specification-first storySort order",
        }),
      );
    } else {
      const specificationOrder = order.filter((title) =>
        title.startsWith(`${options.titlePrefix}/`),
      );
      if (
        order[0] !== expectedOrder[0] ||
        JSON.stringify(specificationOrder) !== JSON.stringify(expectedOrder)
      ) {
        findings.push(
          diagnostic({
            code: "SPEC-MIRROR-ORDER",
            rule,
            file: options.previewPath,
            message:
              "inline Storybook specification order must be first and match SUMMARY.md",
          }),
        );
      }
    }
  }
  findings.push(...validateRegistry(context, entries));
  return findings;
}
