import { dirname, isAbsolute, resolve } from "jsr:@std/path@1.1.6";

import { loadWorkspaceDeclaration } from "./config.ts";
import type { PackageManifest } from "./types.ts";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

function isLocalSpecifier(value: string): boolean {
  return /^(?:link|file|workspace):/u.test(value) || isAbsolute(value);
}

export function createPortableManifest(
  repoRoot: string,
  sourceManifest: PackageManifest,
): PackageManifest {
  const declaration = loadWorkspaceDeclaration(repoRoot);
  const ranges = new Map(
    declaration.links.map((link) => [link.name, link.range]),
  );
  const output = structuredClone(sourceManifest);
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = output[section];
    if (!dependencies) continue;
    for (const [name, value] of Object.entries(dependencies)) {
      if (!isLocalSpecifier(value)) continue;
      const range = ranges.get(name);
      if (!range) {
        throw new Error(
          `${section}.${name} uses unmapped local specifier ${value}`,
        );
      }
      dependencies[name] = range;
    }
  }
  return output;
}

export function writePortableManifest(
  repoRoot: string,
  sourcePath: string,
  outputPath: string,
): void {
  const source = resolve(repoRoot, sourcePath);
  const output = resolve(repoRoot, outputPath);
  if (source === output) {
    throw new Error("pack output must not overwrite the source manifest");
  }
  const manifest = JSON.parse(Deno.readTextFileSync(source)) as PackageManifest;
  const portable = createPortableManifest(repoRoot, manifest);
  Deno.mkdirSync(dirname(output), { recursive: true });
  Deno.writeTextFileSync(output, `${JSON.stringify(portable, null, 2)}\n`);
}
