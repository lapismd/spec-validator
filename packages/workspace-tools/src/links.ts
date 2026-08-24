import { dirname, relative, resolve } from "jsr:@std/path@1.1.6";

import { validateWorkspaceLinks } from "./config.ts";

interface OwnedEntry {
  path: string;
  target: string;
}

interface LinkState {
  schemaVersion: 1;
  entries: OwnedEntry[];
}

const STATE_FILE = ".lapismd-links.json";

function readState(repoRoot: string): LinkState {
  const statePath = resolve(repoRoot, "node_modules", STATE_FILE);
  try {
    const value = JSON.parse(Deno.readTextFileSync(statePath)) as LinkState;
    if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
      throw new Error(`${statePath} has an unsupported schema`);
    }
    return value;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { schemaVersion: 1, entries: [] };
    }
    throw error;
  }
}

function readSymlinkTarget(path: string): string | null {
  try {
    const info = Deno.lstatSync(path);
    if (!info.isSymlink) return null;
    return resolve(dirname(path), Deno.readLinkSync(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }
}

function ensureOwnedOrEmpty(
  destination: string,
  target: string,
  previous: Map<string, string>,
): void {
  let info: Deno.FileInfo;
  try {
    info = Deno.lstatSync(destination);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  if (!info.isSymlink) {
    throw new Error(`refusing to replace non-symlink ${destination}`);
  }
  const actual = resolve(dirname(destination), Deno.readLinkSync(destination));
  if (actual === target) return;
  if (previous.get(destination) !== actual) {
    throw new Error(`refusing to replace unowned symlink ${destination}`);
  }
  Deno.removeSync(destination);
}

function createLink(
  destination: string,
  target: string,
  type: "dir" | "file",
): void {
  Deno.mkdirSync(dirname(destination), { recursive: true });
  try {
    const actual = readSymlinkTarget(destination);
    if (actual === target) return;
  } catch {
    // Ownership checks run before this helper.
  }
  Deno.symlinkSync(relative(dirname(destination), target), destination, {
    type,
  });
}

export function syncWorkspaceLinks(repoRoot: string): LinkState {
  const links = validateWorkspaceLinks(repoRoot).filter(
    (link) => link.declaration.direction === "dependency",
  );
  const nodeModules = resolve(repoRoot, "node_modules");
  Deno.mkdirSync(nodeModules, { recursive: true });
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
    if (actual === entry.target) Deno.removeSync(destination);
  }

  desired.sort((left, right) => left.path.localeCompare(right.path));
  const state: LinkState = { schemaVersion: 1, entries: desired };
  const statePath = resolve(nodeModules, STATE_FILE);
  const temporary = `${statePath}.${Deno.pid}.tmp`;
  Deno.writeTextFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  Deno.renameSync(temporary, statePath);
  return state;
}
