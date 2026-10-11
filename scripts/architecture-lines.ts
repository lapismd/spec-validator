/**
 * Counted-line metric for SV-ARCH-008: physical lines minus blank lines minus
 * comment-only lines. This is the shared LapisMD community counter ported to
 * the canonical Deno runtime; do not invent a second metric.
 */

export function physicalLines(text: string): number {
  if (text.length === 0) return 0;
  const lines = text.split("\n");
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

export function countedLines(text: string): number {
  let inBlock = false;
  let inHtml = false;
  let total = 0;
  const lines = text.length === 0 ? [] : text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  for (const line of lines) {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes("*/")) inBlock = false;
      continue;
    }
    if (inHtml) {
      if (trimmed.includes("-->")) inHtml = false;
      continue;
    }
    if (trimmed === "") continue;
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlock = true;
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      if (!trimmed.includes("-->")) inHtml = true;
      continue;
    }
    if (trimmed.startsWith("//")) continue;
    // Leftover doc-comment continuation lines are not code, but a line that
    // carries a delimiter or a JSDoc tag is treated as content.
    if (
      trimmed.startsWith("*") &&
      !/[{};,]/.test(trimmed) &&
      !/^\*(?:[.#:\[]|\/)/.test(trimmed)
    ) {
      continue;
    }
    total += 1;
  }
  return total;
}
