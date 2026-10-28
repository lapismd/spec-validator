#!/usr/bin/env -S tsx

import process from "node:process";
import { realpathSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { validateWorkspaceLinks } from "./config.js";
import { runWorkspaceTask } from "./graph.js";
import { syncWorkspaceLinks } from "./links.js";
import { writePortableManifest } from "./pack.js";

function usage(): string {
  return [
    "Usage:",
    "  lapismd-workspace links check [--root <path>]",
    "  lapismd-workspace links sync [--root <path>]",
    "  lapismd-workspace run <task> [--root <path>] [--filter <glob>] [--include-dependencies] [--include-dependents] [--no-cache]",
    "  lapismd-workspace pack --package-json <path> --output <path> [--root <path>]",
  ].join("\n");
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  args.splice(index, 2);
  return value;
}

export async function main(
  input: string[] = process.argv.slice(2),
): Promise<number> {
  const args = [...input];
  try {
    const root = resolvePath(takeOption(args, "--root") ?? process.cwd());
    const command = args.shift();
    if (command === "links") {
      const action = args.shift();
      if (args.length > 0 || (action !== "check" && action !== "sync")) {
        throw new Error(usage());
      }
      const links =
        action === "check"
          ? validateWorkspaceLinks(root)
          : syncWorkspaceLinks(root).entries;
      console.log(
        `${action} passed: ${links.length} link entr${
          links.length === 1 ? "y" : "ies"
        }.`,
      );
      return 0;
    }
    if (command === "run") {
      const task = args.shift();
      const filter = takeOption(args, "--filter");
      const includeDependencies = args.includes("--include-dependencies");
      const includeDependents = args.includes("--include-dependents");
      const cache = !args.includes("--no-cache");
      const remaining = args.filter(
        (arg) =>
          arg !== "--include-dependencies" &&
          arg !== "--include-dependents" &&
          arg !== "--no-cache",
      );
      if (!task || remaining.length > 0) throw new Error(usage());
      await runWorkspaceTask(root, task, {
        filter,
        includeDependencies,
        includeDependents,
        cache,
      });
      return 0;
    }
    if (command === "pack") {
      const source = takeOption(args, "--package-json");
      const output = takeOption(args, "--output");
      if (!source || !output || args.length > 0) throw new Error(usage());
      writePortableManifest(root, source, output);
      console.log(`wrote portable manifest ${resolvePath(root, output)}`);
      return 0;
    }
    throw new Error(usage());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

function isEntrypoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return (
      realpathSync(resolvePath(invoked)) === fileURLToPath(import.meta.url)
    );
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  process.exitCode = await main();
}
