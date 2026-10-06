import { createSpecModel } from "./model.js";
import { expandSummary } from "./navigation.js";
import {
  path,
  readdirSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "./platform/current.js";
import type { ResolvedConfig } from "./types.js";
export function stageBook(repoRoot: string, config: ResolvedConfig): string {
  if (!config.validators.summary || !config.validators.summary.fragments)
    return "./spec";
  const model = createSpecModel(repoRoot, config);
  const navigation = expandSummary(model.files);
  const stage = path.join(repoRoot, "spec/.generated");
  function copy(source: string, destination: string) {
    mkdirSync(destination, { recursive: true });
    for (const item of readdirSync(source, { withFileTypes: true })) {
      if (item.isSymbolicLink())
        throw new Error(`book source cannot be a symlink: ${item.name}`);
      if (item.isDirectory())
        copy(path.join(source, item.name), path.join(destination, item.name));
      else if (item.isFile())
        copyFileSync(
          path.join(source, item.name),
          path.join(destination, item.name),
        );
    }
  }
  copy(model.sourceDirectory, path.join(stage, "src"));
  writeFileSync(path.join(stage, "src/SUMMARY.md"), navigation.source);
  const source = readFileSync(path.join(repoRoot, "spec/book.toml"), "utf8");
  const output = config.validators.book
    ? config.validators.book.buildDir
    : "book";
  writeFileSync(
    path.join(stage, "book.toml"),
    source
      .replace(/^src\s*=.*$/m, 'src = "src"')
      .replace(/^build-dir\s*=.*$/m, `build-dir = "../${output}"`),
  );
  return stage;
}
