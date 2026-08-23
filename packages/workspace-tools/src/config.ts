import { isAbsolute, relative, resolve, SEPARATOR } from "jsr:@std/path@1.1.6";

import {
  type LinkDeclaration,
  type PackageManifest,
  type ValidatedLink,
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceDeclaration,
} from "./types.ts";

const CONFIG_NAME = "lapismd-workspace.json";
const ROOT_KEYS = new Set(["schemaVersion", "repository", "links"]);
const REPOSITORY_KEYS = new Set(["name", "packages", "workspaceRoot"]);
const LINK_KEYS = new Set([
  "name",
  "path",
  "revision",
  "range",
  "requiredExports",
  "requiredFiles",
]);

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function onlyKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown field(s): ${unknown.join(", ")}`,
    );
  }
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${label} must be an array of strings`);
  }
  const normalized = value.map((entry) => entry.trim());
  if (normalized.some((entry) => entry === "")) {
    throw new Error(`${label} must not contain empty strings`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return normalized;
}

function isPortableRange(range: string): boolean {
  if (/^(?:link|file|workspace|npm|jsr):/u.test(range) || isAbsolute(range)) {
    return false;
  }
  return /^(?:\*|[~^]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|(?:[<>]=?\s*\d+\.\d+\.\d+)(?:\s+(?:[<>]=?\s*\d+\.\d+\.\d+))*)$/u.test(
    range,
  );
}

function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/u.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersion(
  left: [number, number, number],
  right: [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function satisfiesRange(version: string, range: string): boolean {
  const actual = parseVersion(version);
  if (!actual || !isPortableRange(range)) return false;
  if (range === "*") return true;
  if (range.startsWith("^")) {
    const minimum = parseVersion(range.slice(1));
    if (!minimum || compareVersion(actual, minimum) < 0) return false;
    const maximum: [number, number, number] =
      minimum[0] > 0
        ? [minimum[0] + 1, 0, 0]
        : minimum[1] > 0
          ? [0, minimum[1] + 1, 0]
          : [0, 0, minimum[2] + 1];
    return compareVersion(actual, maximum) < 0;
  }
  if (range.startsWith("~")) {
    const minimum = parseVersion(range.slice(1));
    return Boolean(
      minimum &&
      compareVersion(actual, minimum) >= 0 &&
      compareVersion(actual, [minimum[0], minimum[1] + 1, 0]) < 0,
    );
  }
  if (!range.startsWith(">") && !range.startsWith("<")) {
    const expected = parseVersion(range);
    return Boolean(expected && compareVersion(actual, expected) === 0);
  }
  return range.split(/\s+/u).every((part) => {
    const match = /^(>=|<=|>|<)(\d+\.\d+\.\d+)$/u.exec(part);
    if (!match) return false;
    const expected = parseVersion(match[2]);
    if (!expected) return false;
    const compared = compareVersion(actual, expected);
    return match[1] === ">="
      ? compared >= 0
      : match[1] === "<="
        ? compared <= 0
        : match[1] === ">"
          ? compared > 0
          : compared < 0;
  });
}

export function parseWorkspaceDeclaration(
  value: unknown,
  source = CONFIG_NAME,
): WorkspaceDeclaration {
  const root = objectValue(value, source);
  onlyKeys(root, ROOT_KEYS, source);
  if (root.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new Error(
      `${source} schemaVersion must be ${WORKSPACE_SCHEMA_VERSION}`,
    );
  }

  const repositoryValue = objectValue(root.repository, `${source}.repository`);
  onlyKeys(repositoryValue, REPOSITORY_KEYS, `${source}.repository`);
  const repository = {
    name: stringValue(repositoryValue.name, `${source}.repository.name`),
    packages: stringArray(
      repositoryValue.packages,
      `${source}.repository.packages`,
    ),
    workspaceRoot: stringValue(
      repositoryValue.workspaceRoot,
      `${source}.repository.workspaceRoot`,
    ),
  };

  if (!Array.isArray(root.links)) {
    throw new Error(`${source}.links must be an array`);
  }
  const links = root.links.map((entry, index): LinkDeclaration => {
    const label = `${source}.links[${index}]`;
    const link = objectValue(entry, label);
    onlyKeys(link, LINK_KEYS, label);
    const range = stringValue(link.range, `${label}.range`);
    if (!isPortableRange(range)) {
      throw new Error(`${label}.range must be a portable semver range`);
    }
    const target = stringValue(link.path, `${label}.path`);
    if (isAbsolute(target)) {
      throw new Error(`${label}.path must be relative`);
    }
    return {
      name: stringValue(link.name, `${label}.name`),
      path: target,
      revision: stringValue(link.revision, `${label}.revision`),
      range,
      requiredExports: stringArray(
        link.requiredExports,
        `${label}.requiredExports`,
      ),
      requiredFiles: stringArray(link.requiredFiles, `${label}.requiredFiles`),
    };
  });

  for (const [index, link] of links.entries()) {
    if (!/^[0-9a-f]{40}$/u.test(link.revision)) {
      throw new Error(
        `${source}.links[${index}].revision must be a full commit ID`,
      );
    }
  }

  const names = links.map((link) => link.name);
  if (new Set(names).size !== names.length) {
    throw new Error(`${source}.links must not contain duplicate package names`);
  }
  if (repository.packages.some((name) => names.includes(name))) {
    throw new Error(
      `${source} cannot link a package owned by the same repository`,
    );
  }
  return { schemaVersion: WORKSPACE_SCHEMA_VERSION, repository, links };
}

export function loadWorkspaceDeclaration(
  repoRoot: string,
): WorkspaceDeclaration {
  const path = resolve(repoRoot, CONFIG_NAME);
  let source: string;
  try {
    source = Deno.readTextFileSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`missing ${path}`);
    }
    throw error;
  }
  try {
    return parseWorkspaceDeclaration(JSON.parse(source), path);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${path} is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

function withinBoundary(boundary: string, target: string): boolean {
  const candidate = relative(boundary, target);
  return (
    candidate === "" ||
    (!candidate.startsWith(`..${SEPARATOR}`) && candidate !== "..")
  );
}

function readPackageManifest(path: string): PackageManifest {
  const packageJson = resolve(path, "package.json");
  try {
    return JSON.parse(Deno.readTextFileSync(packageJson)) as PackageManifest;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`missing target manifest ${packageJson}`);
    }
    throw new Error(
      `could not read target manifest ${packageJson}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function hasExport(manifest: PackageManifest, requiredExport: string): boolean {
  if (requiredExport === "." && !manifest.exports) {
    return (
      typeof manifest.main === "string" || typeof manifest.module === "string"
    );
  }
  if (typeof manifest.exports === "string") return requiredExport === ".";
  return Boolean(
    manifest.exports &&
    typeof manifest.exports === "object" &&
    Object.hasOwn(manifest.exports, requiredExport),
  );
}

function normalizeBins(manifest: PackageManifest): Record<string, string> {
  if (typeof manifest.bin === "string") {
    if (!manifest.name) return {};
    const name = manifest.name.includes("/")
      ? manifest.name.slice(manifest.name.lastIndexOf("/") + 1)
      : manifest.name;
    return { [name]: manifest.bin };
  }
  return manifest.bin && typeof manifest.bin === "object" ? manifest.bin : {};
}

export function validateWorkspaceLinks(repoRoot: string): ValidatedLink[] {
  const declaration = loadWorkspaceDeclaration(repoRoot);
  const boundary = resolve(repoRoot, declaration.repository.workspaceRoot);
  return declaration.links.map((link) => {
    const targetPath = resolve(repoRoot, link.path);
    if (!withinBoundary(boundary, targetPath)) {
      throw new Error(
        `${link.name} target escapes workspace root: ${link.path}`,
      );
    }
    const manifest = readPackageManifest(targetPath);
    if (manifest.name !== link.name) {
      throw new Error(
        `${link.name} target declares package ${String(manifest.name)}`,
      );
    }
    if (!manifest.version || !satisfiesRange(manifest.version, link.range)) {
      throw new Error(
        `${link.name}@${String(
          manifest.version,
        )} does not satisfy ${link.range}`,
      );
    }
    for (const requiredExport of link.requiredExports) {
      if (!hasExport(manifest, requiredExport)) {
        throw new Error(
          `${link.name} is missing required export ${requiredExport}`,
        );
      }
    }
    for (const requiredFile of link.requiredFiles) {
      try {
        Deno.statSync(resolve(targetPath, requiredFile));
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          throw new Error(
            `${link.name} is missing required file ${requiredFile}`,
          );
        }
        throw error;
      }
    }
    const bins = normalizeBins(manifest);
    for (const [name, path] of Object.entries(bins)) {
      try {
        Deno.statSync(resolve(targetPath, path));
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          throw new Error(`${link.name} bin ${name} is missing ${path}`);
        }
        throw error;
      }
    }
    return { declaration: link, targetPath, manifest, bins };
  });
}

export const workspaceConfigName = CONFIG_NAME;
