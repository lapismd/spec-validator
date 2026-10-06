import {
  basename,
  DELIMITER,
  dirname,
  extname,
  fromFileUrl,
  join,
  normalize,
  parse,
  relative,
  resolve,
  SEPARATOR,
  toFileUrl,
} from "jsr:@std/path@1.1.6";

import { installPlatform } from "./current.js";
import type {
  CommandOptions,
  DirectoryEntry,
  RuntimePlatform,
  WritableStreamLike,
} from "./types.js";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function output(stream: typeof Deno.stdout): WritableStreamLike {
  return {
    isTTY: stream.isTerminal(),
    write(value: string) {
      stream.writeSync(encoder.encode(value));
      return true;
    },
  };
}

function directoryEntry(entry: Deno.DirEntry): DirectoryEntry {
  return {
    name: entry.name,
    isDirectory: () => entry.isDirectory,
    isFile: () => entry.isFile,
    isSymbolicLink: () => entry.isSymlink,
  };
}

function homeDir(): string {
  const value = Deno.env.get(
    Deno.build.os === "windows" ? "USERPROFILE" : "HOME",
  );
  if (!value) throw new Error("could not determine the user home directory");
  return value;
}

function spawnSync(
  command: string,
  args: string[],
  options: CommandOptions = {},
) {
  try {
    let executable = command;
    let commandArgs = args;
    if (options.shell && Deno.build.os === "windows") {
      executable = "cmd.exe";
      commandArgs = ["/d", "/s", "/c", command, ...args];
    }
    const inherit = options.stdio === "inherit";
    const result = new Deno.Command(executable, {
      args: commandArgs,
      cwd: options.cwd,
      env: Object.fromEntries(
        Object.entries(options.env ?? {}).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      stdin: inherit ? "inherit" : "null",
      stdout: inherit ? "inherit" : "piped",
      stderr: inherit ? "inherit" : "piped",
    }).outputSync();
    return {
      status: result.code,
      stdout: inherit ? "" : decoder.decode(result.stdout),
      stderr: inherit ? "" : decoder.decode(result.stderr),
    };
  } catch (error) {
    return {
      status: null,
      stdout: "",
      stderr: "",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

const denoPlatform: RuntimePlatform = {
  args: Deno.args,
  get env() {
    return Deno.env.toObject();
  },
  os: Deno.build.os === "windows" ? "win32" : Deno.build.os,
  path: {
    delimiter: DELIMITER,
    sep: SEPARATOR,
    basename,
    dirname,
    extname,
    join,
    normalize,
    parse: (value) => ({ name: parse(value).name }),
    relative,
    resolve,
    fromFileUrl,
    toFileUrl,
  },
  stdout: output(Deno.stdout),
  stderr: output(Deno.stderr),
  cwd: Deno.cwd,
  homeDir,
  copyFileSync: Deno.copyFileSync,
  existsSync(value) {
    try {
      Deno.lstatSync(value);
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return false;
      throw error;
    }
  },
  mkdirSync: Deno.mkdirSync,
  readFileSync: (value) => Deno.readTextFileSync(value),
  readdirSync: (value) => [...Deno.readDirSync(value)].map(directoryEntry),
  realpathSync: Deno.realPathSync,
  spawnSync,
  async spawnAsync(command, args, options = {}) {
    const inherit = options.stdio === "inherit";
    try {
      const shell = options.shell && Deno.build.os === "windows";
      const result = await new Deno.Command(shell ? "cmd.exe" : command, {
        args: shell ? ["/d", "/s", "/c", command, ...args] : args,
        cwd: options.cwd,
        env: Object.fromEntries(
          Object.entries(options.env ?? {}).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
        stdin: inherit ? "inherit" : "null",
        stdout: inherit ? "inherit" : "piped",
        stderr: inherit ? "inherit" : "piped",
      }).output();
      return {
        status: result.code,
        stdout: inherit ? "" : decoder.decode(result.stdout),
        stderr: inherit ? "" : decoder.decode(result.stderr),
      };
    } catch (error) {
      return {
        status: null,
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
  watchPaths(paths, onChange, onError) {
    const watcher = Deno.watchFs(paths, { recursive: true });
    let closed = false;
    void (async () => {
      try {
        for await (const _event of watcher) if (!closed) onChange();
      } catch (error) {
        if (!closed)
          onError(error instanceof Error ? error : new Error(String(error)));
      }
    })();
    return () => {
      closed = true;
      watcher.close();
    };
  },
  removeSync(value) {
    try {
      Deno.removeSync(value, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  },
  writeFileSync: Deno.writeTextFileSync,
};

export function installDenoPlatform(): void {
  installPlatform(denoPlatform);
}
