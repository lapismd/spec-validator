import type { ColorMode } from "./types.js";

export function resolveColorEnabled(
  mode: ColorMode,
  stream: { isTTY?: boolean } = process.stdout,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (mode === "never") return false;
  if (environment.NO_COLOR) return false;
  if (environment.FORCE_COLOR === "0") return false;
  if (mode === "always" || environment.FORCE_COLOR === "1") return true;
  return Boolean(stream.isTTY);
}

const codes = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
} as const;

export function createPalette(enabled: boolean) {
  const paint = (code: string, value: string) =>
    enabled ? `${code}${value}${codes.reset}` : value;
  return {
    enabled,
    bold: (value: string) => paint(codes.bold, value),
    dim: (value: string) => paint(codes.dim, value),
    red: (value: string) => paint(codes.red, value),
    green: (value: string) => paint(codes.green, value),
    yellow: (value: string) => paint(codes.yellow, value),
    cyan: (value: string) => paint(codes.cyan, value),
    gray: (value: string) => paint(codes.gray, value),
  };
}

export type Palette = ReturnType<typeof createPalette>;
