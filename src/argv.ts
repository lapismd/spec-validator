import type { ColorMode, OutputOptions } from "./types.js";

export class UsageError extends Error {}

export interface ParsedArgv {
  command?: string;
  rest: string[];
  output: OutputOptions;
  help: boolean;
}

export function parseColor(value: string | undefined): ColorMode {
  if (!value || value === "true") return "always";
  if (value === "auto" || value === "always" || value === "never") return value;
  throw new UsageError(`--color must be auto, always, or never`);
}

export function parseGlobalArgv(argv: string[]): ParsedArgv {
  const rest: string[] = [];
  let color: ColorMode = "auto";
  let json = false;
  let help = false;
  let command: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!command && !argument.startsWith("-")) {
      command = argument;
      continue;
    }
    if (argument === "--help" || argument === "-h") help = true;
    else if (argument === "--json") json = true;
    else if (argument === "--no-color") color = "never";
    else if (argument === "--color") {
      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        color = parseColor(next);
        index += 1;
      } else color = "always";
    } else if (argument.startsWith("--color=")) {
      color = parseColor(argument.slice("--color=".length));
    } else rest.push(argument);
  }
  return { command, rest, output: { color, json }, help };
}

export function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-"))
    throw new UsageError(`${name} requires a value`);
  return value;
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

export function readList(argv: string[], name: string): string[] | undefined {
  const value = readFlag(argv, name);
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

export function assertCommandArgs(
  argv: string[],
  {
    boolean = [],
    value = [],
    positionals = false,
  }: { boolean?: string[]; value?: string[]; positionals?: boolean } = {},
): void {
  const booleanSet = new Set(boolean);
  const valueSet = new Set(value);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (booleanSet.has(argument)) continue;
    if (valueSet.has(argument)) {
      const next = argv[index + 1];
      if (!next || next.startsWith("-")) {
        throw new UsageError(`${argument} requires a value`);
      }
      index += 1;
      continue;
    }
    if (!argument.startsWith("-") && positionals) continue;
    throw new UsageError(`unknown argument: ${argument}`);
  }
}

export function usage(): string {
  return [
    "Usage: spec-validator <command> [options]",
    "",
    "Commands:",
    "  validate   Run enabled specification validators",
    "  check      Validate, optional tests, mdBook build, and spec-first",
    "  build      Build the mdBook",
    "  serve      Serve the mdBook",
    "  first      Run the spec-first change gate",
    "  search     Search the QMD specification collection",
    "  index      Refresh the QMD specification collection",
    "  list       List enabled validators",
    "  init       Scaffold config, scripts, and optional skill",
    "  doctor     Verify config and host wiring",
    "  skill      Install the global Agents skill",
    "",
    "Global options:",
    "  --json                 Versioned machine-readable output",
    "  --color[=auto|always|never]",
    "  --no-color             Disable ANSI color",
    "  -h, --help             Show this help",
  ].join("\n");
}
