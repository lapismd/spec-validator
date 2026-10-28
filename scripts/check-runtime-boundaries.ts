/**
 * Node runtime boundary audit (SV-ARCH-005): first-party source, scripts,
 * tests, and workspace tooling MUST run on Node without residual Deno
 * globals, `jsr:` imports, or retired Deno runtime files.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
const findings: string[] = [];
const sourceRoots = ["src", "scripts", "tests", "packages/workspace-tools/src"];
const sourcePatterns = [
  { pattern: /\bDeno\./u, label: "Deno global" },
  { pattern: /from\s+["']jsr:/u, label: "jsr import" },
  { pattern: /\bimport\.meta\.main\b/u, label: "Deno entrypoint check" },
];
const retiredFiles = [
  "deno.json",
  "deno.lock",
  "src/cli.deno.ts",
  "src/index.deno.ts",
  "src/platform/deno.ts",
  "src/deno-contract.ts",
  "scripts/check-deno-version.ts",
  "packages/workspace-tools/deno.json",
];
const requiredFiles = ["package.json", "pnpm-lock.yaml"];
const guidanceFiles = ["package.json", "AGENTS.md", "README.md"];
const denoCommandPattern =
  /\bdeno\s+(?:task|run|install|test|check|bundle|ci|add|eval|publish)\b/iu;

function toRelative(path: string): string {
  return relative(repositoryRoot, path).split("\\").join("/");
}

function visit(directory: string): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "architecture-fixtures") continue;
      visit(absolute);
      continue;
    }
    if (
      !entry.isFile() ||
      ![".ts", ".js", ".mjs"].includes(extname(entry.name))
    ) {
      continue;
    }
    const path = toRelative(absolute);
    const source = readFileSync(absolute, "utf8");
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

for (const retired of retiredFiles) {
  if (existsSync(resolve(repositoryRoot, retired))) {
    findings.push(`${retired}: retired Deno runtime file is still present`);
  }
}

for (const required of requiredFiles) {
  const absolute = resolve(repositoryRoot, required);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    findings.push(`${required}: required Node package-manager file is missing`);
  }
}

for (const active of guidanceFiles) {
  const source = readFileSync(resolve(repositoryRoot, active), "utf8");
  if (denoCommandPattern.test(source)) {
    findings.push(`${active}: active Deno command reference remains`);
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.error(finding);
  process.exitCode = 1;
} else {
  console.log("Node runtime boundary audit passed.");
}
