export const REQUIRED_DENO_VERSION = "2.9.5";

export const DENO_TASKS: Record<string, string> = {
  "version:check": "deno run --no-prompt ./scripts/check-deno-version.ts",
  "spec:validate": "deno task version:check && spec-validator validate",
  "spec:check": "deno task version:check && spec-validator check",
  "spec:first": "deno task version:check && spec-validator first",
  "spec:build": "deno task version:check && spec-validator build",
  "spec:serve": "deno task version:check && spec-validator serve",
  "spec:search": "deno task version:check && spec-validator search",
  "spec:index": "deno task version:check && spec-validator index",
};

export const PACKAGE_SCRIPT_ALIASES: Record<string, string> =
  Object.fromEntries(
    Object.keys(DENO_TASKS)
      .filter((name) => name.startsWith("spec:"))
      .map((name) => [name, `deno task ${name}`]),
  );

export function renderDenoVersionCheck(): string {
  return `const required = "${REQUIRED_DENO_VERSION}";\nif (Deno.version.deno !== required) {\n  console.error(\`Deno \${required} is required; found \${Deno.version.deno}.\`);\n  Deno.exit(1);\n}\n`;
}
