import { dirname, relative, resolve, SEPARATOR } from "jsr:@std/path@1.1.6";

import {
  loadWorkspaceDeclaration,
  validateWorkspaceLinks,
  workspaceConfigName,
} from "./config.ts";
import type { WorkspaceGraph, WorkspaceGraphNode } from "./types.ts";

export interface RunOptions {
  filter?: string;
  includeDependencies?: boolean;
  includeDependents?: boolean;
  cache?: boolean;
}

export type TaskRunner = (
  node: WorkspaceGraphNode,
  task: string,
) => number | Promise<number>;

interface CacheState {
  schemaVersion: 1;
  entries: Record<string, string>;
}

const CACHE_FILE = ".deno/lapismd-workspace-task-cache.json";

function withinBoundary(boundary: string, target: string): boolean {
  const candidate = relative(boundary, target);
  return (
    candidate === "" ||
    (!candidate.startsWith(`..${SEPARATOR}`) && candidate !== "..")
  );
}

function ownedPath(root: string, path: string, label: string): string {
  const absolute = resolve(root, path);
  if (!withinBoundary(root, absolute)) {
    throw new Error(`${label} escapes repository root: ${path}`);
  }
  return absolute;
}

function cacheState(repoRoot: string): CacheState {
  const path = resolve(repoRoot, CACHE_FILE);
  try {
    const value = JSON.parse(Deno.readTextFileSync(path)) as CacheState;
    if (
      value.schemaVersion !== 1 ||
      !value.entries ||
      typeof value.entries !== "object"
    ) {
      throw new Error(`${path} has an unsupported schema`);
    }
    return value;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { schemaVersion: 1, entries: {} };
    }
    throw error;
  }
}

function writeCacheState(repoRoot: string, state: CacheState): void {
  const path = resolve(repoRoot, CACHE_FILE);
  Deno.mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${Deno.pid}.tmp`;
  Deno.writeTextFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  Deno.renameSync(temporary, path);
}

function collectInputFiles(root: string, paths: string[]): string[] {
  const files: string[] = [];
  const visit = (path: string): void => {
    let info: Deno.FileInfo;
    try {
      info = Deno.lstatSync(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`cache input is missing: ${relative(root, path)}`);
      }
      throw error;
    }
    if (info.isSymlink || info.isFile) {
      files.push(path);
      return;
    }
    if (!info.isDirectory) return;
    const entries = [...Deno.readDirSync(path)].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    for (const entry of entries) visit(resolve(path, entry.name));
  };
  for (const path of paths) {
    visit(ownedPath(root, path, "cache input"));
  }
  return [...new Set(files)].sort();
}

function toHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function taskFingerprint(
  root: string,
  inputs: string[],
): Promise<string> {
  const parts: string[] = [];
  for (const path of collectInputFiles(root, inputs)) {
    const info = Deno.lstatSync(path);
    const bytes = info.isSymlink
      ? new TextEncoder().encode(Deno.readLinkSync(path))
      : Deno.readFileSync(path);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    parts.push(`${relative(root, path)}\0${toHex(digest)}`);
  }
  return toHex(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(parts.join("\n")),
    ),
  );
}

function outputsExist(root: string, outputs: string[]): boolean {
  return outputs.every((output) => {
    try {
      Deno.lstatSync(ownedPath(root, output, "cache output"));
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return false;
      throw error;
    }
  });
}

function findRepositoryRoot(start: string, boundary: string): string {
  let candidate = resolve(start);
  const limit = resolve(boundary);
  while (true) {
    try {
      Deno.statSync(resolve(candidate, workspaceConfigName));
      return candidate;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    if (candidate === limit || dirname(candidate) === candidate) break;
    candidate = dirname(candidate);
  }
  throw new Error(`no ${workspaceConfigName} found for ${start}`);
}

export function buildWorkspaceGraph(repoRoot: string): WorkspaceGraph {
  const rootDeclaration = loadWorkspaceDeclaration(repoRoot);
  const workspaceRoot = resolve(
    repoRoot,
    rootDeclaration.repository.workspaceRoot,
  );
  const nodes = new Map<string, WorkspaceGraphNode>();
  const roots = new Map<string, string>();

  const visit = (root: string): string => {
    const normalizedRoot = resolve(root);
    const existingName = roots.get(normalizedRoot);
    if (existingName) return existingName;
    const declaration = loadWorkspaceDeclaration(root);
    const name = declaration.repository.name;
    const existingNode = nodes.get(name);
    if (existingNode && resolve(existingNode.root) !== normalizedRoot) {
      throw new Error(`workspace graph contains duplicate repository ${name}`);
    }
    roots.set(normalizedRoot, name);
    const node = existingNode ?? {
      name,
      root: normalizedRoot,
      packages: declaration.repository.packages,
      dependencies: [],
    };
    nodes.set(name, node);
    for (const link of validateWorkspaceLinks(root)) {
      const dependencyRoot = findRepositoryRoot(link.targetPath, workspaceRoot);
      const linkedName = visit(dependencyRoot);
      if (linkedName === name) continue;
      const linkedNode = nodes.get(linkedName)!;
      if (link.declaration.direction === "dependency") {
        node.dependencies = [...new Set([...node.dependencies, linkedName])]
          .sort();
      } else {
        linkedNode.dependencies = [
          ...new Set([...linkedNode.dependencies, name]),
        ].sort();
      }
    }
    return name;
  };

  const current = visit(resolve(repoRoot));
  const graph = { current, nodes };
  orderWorkspaceNodes(graph, new Set(nodes.keys()));
  return graph;
}

function matches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`, "u").test(value);
}

function expandDependencies(
  graph: WorkspaceGraph,
  selected: Set<string>,
): void {
  const pending = [...selected];
  while (pending.length > 0) {
    const name = pending.pop()!;
    for (const dependency of graph.nodes.get(name)?.dependencies ?? []) {
      if (selected.has(dependency)) continue;
      selected.add(dependency);
      pending.push(dependency);
    }
  }
}

function expandDependents(graph: WorkspaceGraph, selected: Set<string>): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph.nodes.values()) {
      if (
        !selected.has(node.name) &&
        node.dependencies.some((dependency) => selected.has(dependency))
      ) {
        selected.add(node.name);
        changed = true;
      }
    }
  }
}

export function selectWorkspaceNodes(
  graph: WorkspaceGraph,
  options: RunOptions,
): Set<string> {
  const selected = new Set<string>();
  if (options.filter) {
    for (const node of graph.nodes.values()) {
      if (
        matches(options.filter, node.name) ||
        node.packages.some((name) => matches(options.filter!, name))
      ) {
        selected.add(node.name);
      }
    }
    if (selected.size === 0) {
      throw new Error(
        `workspace filter matched no repositories: ${options.filter}`,
      );
    }
  } else {
    selected.add(graph.current);
  }
  if (options.includeDependencies) expandDependencies(graph, selected);
  if (options.includeDependents) expandDependents(graph, selected);
  return selected;
}

export function orderWorkspaceNodes(
  graph: WorkspaceGraph,
  selected: Set<string>,
): WorkspaceGraphNode[] {
  const output: WorkspaceGraphNode[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();
  const visit = (name: string): void => {
    if (permanent.has(name)) return;
    if (temporary.has(name)) {
      throw new Error(`workspace dependency cycle includes ${name}`);
    }
    temporary.add(name);
    const node = graph.nodes.get(name);
    if (!node) throw new Error(`workspace graph is missing ${name}`);
    for (const dependency of node.dependencies) {
      if (selected.has(dependency)) visit(dependency);
    }
    temporary.delete(name);
    permanent.add(name);
    output.push(node);
  };
  for (const name of [...selected].sort()) visit(name);
  return output;
}

const defaultRunner: TaskRunner = (node, task) => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["task", task],
    cwd: node.root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return command.spawn().status.then((status) => status.code);
};

export async function runWorkspaceTask(
  repoRoot: string,
  task: string,
  options: RunOptions = {},
  runner: TaskRunner = defaultRunner,
): Promise<void> {
  if (!task || task.startsWith("-")) {
    throw new Error("run requires a task name");
  }
  const graph = buildWorkspaceGraph(repoRoot);
  const selected = selectWorkspaceNodes(graph, options);
  const cache = cacheState(repoRoot);
  for (const node of orderWorkspaceNodes(graph, selected)) {
    const contract = loadWorkspaceDeclaration(node.root).repository.tasks[task];
    const cacheKey = `${node.name}:${task}`;
    const fingerprint = contract && options.cache !== false
      ? await taskFingerprint(node.root, contract.inputs)
      : null;
    if (
      contract &&
      fingerprint &&
      cache.entries[cacheKey] === fingerprint &&
      outputsExist(node.root, contract.outputs)
    ) {
      console.log(`${node.name}: ${task} cache hit`);
      continue;
    }
    const code = await runner(node, task);
    if (code !== 0) {
      throw new Error(
        `${node.name} task ${task} failed with exit code ${code}`,
      );
    }
    if (contract && options.cache !== false) {
      if (!outputsExist(node.root, contract.outputs)) {
        throw new Error(
          `${node.name} task ${task} completed without declared output`,
        );
      }
      cache.entries[cacheKey] = await taskFingerprint(
        node.root,
        contract.inputs,
      );
      writeCacheState(repoRoot, cache);
    }
  }
}
