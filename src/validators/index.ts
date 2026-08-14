import type { ResolvedConfig, Validator } from "../types.js";
import * as book from "./book.js";
import * as governance from "./governance.js";
import * as markdownlint from "./markdownlint.js";
import * as packageManifest from "./package-manifest.js";
import * as publicSurfaces from "./public-surfaces.js";
import * as qmd from "./qmd.js";
import * as specFirst from "./spec-first.js";
import * as storybookCatalog from "./storybook-catalog.js";
import * as storybookMirrors from "./storybook-mirrors.js";
import * as summary from "./summary.js";
import * as verification from "./verification.js";

const BUILTINS: Record<string, Validator> = {
  summary,
  governance,
  verification,
  book,
  publicSurfaces,
  storybookCatalog,
  storybookMirrors,
  qmd,
  markdownlint,
  packageManifest,
  specFirst,
};

export const BUILTIN_VALIDATOR_NAMES = Object.keys(BUILTINS);

export function enabledValidators(
  config: ResolvedConfig,
  {
    only,
    skip,
    exclude,
  }: { only?: string[]; skip?: string[]; exclude?: string[] } = {},
): Validator[] {
  const skipSet = new Set([...(skip ?? []), ...(exclude ?? [])]);
  return BUILTIN_VALIDATOR_NAMES.filter((name) => {
    if (only?.length && !only.includes(name)) return false;
    if (skipSet.has(name)) return false;
    return config.validators[name as keyof typeof config.validators] !== false;
  }).map((name) => BUILTINS[name]!);
}

export { BUILTINS };
