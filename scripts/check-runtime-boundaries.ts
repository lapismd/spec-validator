import { extname, relative, resolve, SEPARATOR } from "jsr:@std/path@1.1.6";

const repositoryRoot = resolve(import.meta.dirname!, "..");
const findings: string[] = [];
const compatibilityFiles = new Set([
  "scripts/check-runtime-boundaries.ts",
  "src/cli.ts",
  "src/platform/node.ts",
  "src/test-setup.ts",
]);
const sourceRoots = ["src", "scripts", "packages/workspace-tools/src"];
const sourcePatterns = [
  { pattern: /from\s+["']node:/u, label: "node import" },
  { pattern: /\brequire\s*\(/u, label: "CommonJS require" },
  { pattern: /\bprocess\./u, label: "process global" },
  { pattern: /\bBuffer\b/u, label: "Buffer global" },
];

function toRelative(path: string): string {
  return relative(repositoryRoot, path).split(SEPARATOR).join("/");
}

function isCompatibilityPath(path: string): boolean {
  return (
    compatibilityFiles.has(path) || /\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(path)
  );
}

function visit(directory: string): void {
  for (const entry of Deno.readDirSync(directory)) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory) {
      visit(absolute);
      continue;
    }
    if (
      !entry.isFile ||
      ![".ts", ".js", ".mjs"].includes(extname(entry.name))
    ) {
      continue;
    }
    const path = toRelative(absolute);
    if (isCompatibilityPath(path)) continue;
    const source = Deno.readTextFileSync(absolute);
    for (const rule of sourcePatterns) {
      if (rule.pattern.test(source)) {
        findings.push(`${path}: forbidden ${rule.label}`);
      }
    }
  }
}

for (const sourceRoot of sourceRoots) {
  visit(resolve(repositoryRoot, sourceRoot));
}

for (const retired of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json"]) {
  try {
    Deno.lstatSync(resolve(repositoryRoot, retired));
    findings.push(`${retired}: retired package-manager file is still present`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

for (const active of ["package.json", "AGENTS.md", "README.md"]) {
  const source = Deno.readTextFileSync(resolve(repositoryRoot, active));
  if (/\bpnpm(?:\s|@|:)/u.test(source)) {
    findings.push(`${active}: active pnpm command or declaration remains`);
  }
  if (/\bturbo(?:\s|@|:)/iu.test(source)) {
    findings.push(`${active}: active Turbo command or declaration remains`);
  }
}

const config = JSON.parse(
  Deno.readTextFileSync(resolve(repositoryRoot, "deno.json")),
) as { tasks?: Record<string, string> };
if (!config.tasks?.["version:check"]) {
  findings.push("deno.json: version:check task is missing");
}

if (findings.length > 0) {
  for (const finding of findings) console.error(finding);
  Deno.exit(1);
}
console.log("Deno runtime boundary audit passed.");
