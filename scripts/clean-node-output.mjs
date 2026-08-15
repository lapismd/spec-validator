import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const output = path.join(repositoryRoot, "dist");

if (
  path.dirname(output) !== repositoryRoot ||
  path.basename(output) !== "dist"
) {
  throw new Error(`refusing to clean unexpected build output: ${output}`);
}

rmSync(output, { recursive: true, force: true });
