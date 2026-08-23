import { basename, dirname, fromFileUrl, resolve } from "jsr:@std/path@1.1.6";

const repositoryRoot = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const output = resolve(repositoryRoot, "dist");

if (dirname(output) !== repositoryRoot || basename(output) !== "dist") {
  throw new Error(`refusing to clean unexpected build output: ${output}`);
}

try {
  Deno.removeSync(output, { recursive: true });
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}
