import type { ResolvedConfig } from "./types.js";
import { path, watchPaths } from "./platform/current.js";
import { stageBook } from "./book-staging.js";
export function watchBookSources(
  root: string,
  config: ResolvedConfig,
  onError: (error: Error) => void,
): () => void {
  if (!config.validators.summary || !config.validators.summary.fragments)
    return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = watchPaths(
    [path.join(root, config.specDir), path.join(root, "spec/book.toml")],
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          stageBook(root, config);
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }, 200);
    },
    onError,
  );
  return () => {
    clearTimeout(timer);
    stop();
  };
}
