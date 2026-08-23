import { dirname, resolve } from "jsr:@std/path@1.1.6";

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
}

export type TaskRunner = (
  node: WorkspaceGraphNode,
  task: string,
) => number | Promise<number>;

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
  const visiting = new Set<string>();

  const visit = (root: string): string => {
    const declaration = loadWorkspaceDeclaration(root);
    const name = declaration.repository.name;
    if (nodes.has(name)) return name;
    if (visiting.has(name)) {
      throw new Error(`workspace dependency cycle includes ${name}`);
    }
    visiting.add(name);
    const dependencies = new Set<string>();
    for (const link of validateWorkspaceLinks(root)) {
      const dependencyRoot = findRepositoryRoot(link.targetPath, workspaceRoot);
      const dependencyName = visit(dependencyRoot);
      if (dependencyName !== name) dependencies.add(dependencyName);
    }
    visiting.delete(name);
    nodes.set(name, {
      name,
      root,
      packages: declaration.repository.packages,
      dependencies: [...dependencies].sort(),
    });
    return name;
  };

  const current = visit(resolve(repoRoot));
  return { current, nodes };
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
  for (const node of orderWorkspaceNodes(graph, selected)) {
    const code = await runner(node, task);
    if (code !== 0) {
      throw new Error(
        `${node.name} task ${task} failed with exit code ${code}`,
      );
    }
  }
}
