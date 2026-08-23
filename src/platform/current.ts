import type {
  CommandOptions,
  DirectoryEntry,
  RuntimePlatform,
  WritableStreamLike,
} from "./types.js";

let installed: RuntimePlatform | undefined;

export function installPlatform(platform: RuntimePlatform): void {
  installed = platform;
}

export function currentPlatform(): RuntimePlatform {
  if (!installed) throw new Error("runtime platform is not installed");
  return installed;
}

export const path = {
  get delimiter(): string {
    return currentPlatform().path.delimiter;
  },
  get sep(): string {
    return currentPlatform().path.sep;
  },
  basename: (value: string) => currentPlatform().path.basename(value),
  dirname: (value: string) => currentPlatform().path.dirname(value),
  extname: (value: string) => currentPlatform().path.extname(value),
  join: (...parts: string[]) => currentPlatform().path.join(...parts),
  normalize: (value: string) => currentPlatform().path.normalize(value),
  parse: (value: string) => currentPlatform().path.parse(value),
  relative: (from: string, to: string) =>
    currentPlatform().path.relative(from, to),
  resolve: (...parts: string[]) => currentPlatform().path.resolve(...parts),
};

export const os = { homedir: () => currentPlatform().homeDir() };

export const runtime = {
  get args(): string[] {
    return currentPlatform().args;
  },
  get env(): Record<string, string | undefined> {
    return currentPlatform().env;
  },
  get platform(): string {
    return currentPlatform().os;
  },
  get nodeAbi(): string | undefined {
    return currentPlatform().nodeAbi;
  },
  get stdout(): WritableStreamLike {
    return currentPlatform().stdout;
  },
  get stderr(): WritableStreamLike {
    return currentPlatform().stderr;
  },
  cwd: () => currentPlatform().cwd(),
};

export const copyFileSync = (source: string, destination: string): void =>
  currentPlatform().copyFileSync(source, destination);
export const existsSync = (value: string): boolean =>
  currentPlatform().existsSync(value);
export const mkdirSync = (
  value: string,
  options?: { recursive?: boolean },
): void => currentPlatform().mkdirSync(value, options);
export const readFileSync = (value: string, encoding: "utf8"): string =>
  currentPlatform().readFileSync(value, encoding);
export const readdirSync = (
  value: string,
  options: { withFileTypes: true },
): DirectoryEntry[] => currentPlatform().readdirSync(value, options);
export const realpathSync = (value: string): string =>
  currentPlatform().realpathSync(value);
export const spawnSync = (
  command: string,
  args: string[],
  options?: CommandOptions,
) => currentPlatform().spawnSync(command, args, options);
export const writeFileSync = (value: string, contents: string): void =>
  currentPlatform().writeFileSync(value, contents);
export const fileURLToPath = (url: string | URL): string =>
  currentPlatform().path.fromFileUrl(url);
export const pathToFileURL = (value: string): URL =>
  currentPlatform().path.toFileUrl(value);
