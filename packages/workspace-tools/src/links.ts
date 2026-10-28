import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  type Stats,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import process from "node:process";
import { dirname, relative, resolve } from "node:path";

import { validateWorkspaceLinks } from "./config.js";

interface OwnedEntry {
  path: string;
  target: string;
}

interface LinkState {
  schemaVersion: 1;
  entries: OwnedEntry[];
}

const STATE_FILE = ".lapismd-links.json";

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function readState(repoRoot: string): LinkState {
  const statePath = resolve(repoRoot, "node_modules", STATE_FILE);
  try {
    const value = JSON.parse(readFileSync(statePath, "utf8")) as LinkState;
    if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
      throw new Error(`${statePath} has an unsupported schema`);
    }
    return value;
  } catch (error) {
    if (isNotFound(error)) {
      return { schemaVersion: 1, entries: [] };
    }
    throw error;
  }
}

function readSymlinkTarget(path: string): string | null {
  try {
    const info = lstatSync(path);
    if (!info.isSymbolicLink()) return null;
    return resolve(dirname(path), readlinkSync(path));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function ensureOwnedOrEmpty(
  destination: string,
  target: string,
  previous: Map<string, string>,
): void {
  let info: Stats;
  try {
    info = lstatSync(destination);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  if (!info.isSymbolicLink()) {
    throw new Error(`refusing to replace non-symlink ${destination}`);
  }
  const actual = resolve(dirname(destination), readlinkSync(destination));
  if (actual === target) return;
  if (previous.get(destination) !== actual) {
    throw new Error(`refusing to replace unowned symlink ${destination}`);
  }
  unlinkSync(destination);
}

function createLink(
  destination: string,
  target: string,
  type: "dir" | "file",
): void {
  mkdirSync(dirname(destination), { recursive: true });
  try {
    const actual = readSymlinkTarget(destination);
    if (actual === target) return;
  } catch {
    // Ownership checks run before this helper.
  }
  symlinkSync(relative(dirname(destination), target), destination, type);
}

export function syncWorkspaceLinks(repoRoot: string): LinkState {
  const links = validateWorkspaceLinks(repoRoot).filter(
    (link) => link.declaration.direction === "dependency",
  );
  const nodeModules = resolve(repoRoot, "node_modules");
  mkdirSync(nodeModules, { recursive: true });
  const previousState = readState(repoRoot);
  const previous = new Map(
    previousState.entries.map((entry) => [
      resolve(repoRoot, entry.path),
      entry.target,
    ]),
  );
  const desired: OwnedEntry[] = [];

  for (const link of links) {
    const packageDestination = resolve(nodeModules, link.declaration.name);
    ensureOwnedOrEmpty(packageDestination, link.targetPath, previous);
    createLink(packageDestination, link.targetPath, "dir");
    desired.push({
      path: relative(repoRoot, packageDestination),
      target: link.targetPath,
    });

    for (const [name, binPath] of Object.entries(link.bins)) {
      const target = resolve(link.targetPath, binPath);
      const destination = resolve(nodeModules, ".bin", name);
      ensureOwnedOrEmpty(destination, target, previous);
      createLink(destination, target, "file");
      desired.push({ path: relative(repoRoot, destination), target });
    }
  }

  const desiredPaths = new Set(
    desired.map((entry) => resolve(repoRoot, entry.path)),
  );
  for (const entry of previousState.entries) {
    const destination = resolve(repoRoot, entry.path);
    if (desiredPaths.has(destination)) continue;
    const actual = readSymlinkTarget(destination);
    if (actual === entry.target) unlinkSync(destination);
  }

  desired.sort((left, right) => left.path.localeCompare(right.path));
  const state: LinkState = { schemaVersion: 1, entries: desired };
  const statePath = resolve(nodeModules, STATE_FILE);
  const temporary = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, statePath);
  return state;
}
