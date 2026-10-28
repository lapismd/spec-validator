import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(repositoryRoot, "dist");

if (dirname(output) !== repositoryRoot || basename(output) !== "dist") {
  throw new Error(`refusing to clean unexpected build output: ${output}`);
}

rmSync(output, { recursive: true, force: true });
