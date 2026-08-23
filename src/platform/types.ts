export interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface WritableStreamLike {
  isTTY?: boolean;
  write(value: string): unknown;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  shell?: boolean;
  stdio?: "inherit" | ["ignore", "pipe", "pipe"];
  maxBuffer?: number;
}

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface PathPlatform {
  readonly delimiter: string;
  readonly sep: string;
  basename(path: string): string;
  dirname(path: string): string;
  extname(path: string): string;
  join(...parts: string[]): string;
  normalize(path: string): string;
  parse(path: string): { name: string };
  relative(from: string, to: string): string;
  resolve(...parts: string[]): string;
  fromFileUrl(url: string | URL): string;
  toFileUrl(path: string): URL;
}

export interface RuntimePlatform {
  readonly args: string[];
  readonly env: Record<string, string | undefined>;
  readonly os: string;
  readonly nodeAbi?: string;
  readonly path: PathPlatform;
  readonly stdout: WritableStreamLike;
  readonly stderr: WritableStreamLike;
  cwd(): string;
  homeDir(): string;
  copyFileSync(source: string, destination: string): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string, options: { withFileTypes: true }): DirectoryEntry[];
  realpathSync(path: string): string;
  spawnSync(
    command: string,
    args: string[],
    options?: CommandOptions,
  ): CommandResult;
  writeFileSync(path: string, value: string): void;
}
