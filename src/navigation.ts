import type { SpecFile } from "./types.js";
import { path } from "./platform/current.js";
export function expandSummary(files: SpecFile[]) {
  const byPath = new Map(files.map((file) => [file.chapterPath, file.source]));
  const fragments = new Set<string>();
  function expand(name: string, ancestors: string[]): string {
    if (name.startsWith("/") || name.split("/").includes(".."))
      throw new Error(`unsafe navigation fragment: ${name}`);
    if (ancestors.includes(name))
      throw new Error(
        `navigation include cycle: ${[...ancestors, name].join(" -> ")}`,
      );
    const source = byPath.get(name);
    if (source === undefined)
      throw new Error(`missing navigation fragment: ${name}`);
    return source
      .split(/\r?\n/)
      .map((line) => {
        const include = /^(\s*)\{\{#include ([^}]+)\}\}\s*$/.exec(line);
        if (include) {
          const target = path
            .normalize(path.join(path.dirname(name), include[2]!.trim()))
            .replaceAll("\\", "/");
          fragments.add(target);
          return expand(target, [...ancestors, name])
            .split("\n")
            .map((part) => include[1] + part)
            .join("\n");
        }
        return line.replace(
          /\]\(([^)]+\.md(?:#[^)]*)?)\)/g,
          (whole, target: string) => {
            if (/^(?:[a-z]+:|\/)/i.test(target)) return whole;
            const resolved = path
              .normalize(path.join(path.dirname(name), target))
              .replaceAll("\\", "/");
            if (resolved.startsWith("../"))
              throw new Error(
                `navigation target escapes source root: ${target}`,
              );
            return `](${resolved})`;
          },
        );
      })
      .join("\n");
  }
  return { source: expand("SUMMARY.md", []), fragments };
}
