import {
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
} from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { installPlatform } from "./current.js";
import type { RuntimePlatform } from "./types.js";

const nodePlatform: RuntimePlatform = {
  args: process.argv.slice(2),
  env: process.env,
  os: process.platform,
  nodeAbi: process.versions.modules,
  path: {
    delimiter: nodePath.delimiter,
    sep: nodePath.sep,
    basename: nodePath.basename,
    dirname: nodePath.dirname,
    extname: nodePath.extname,
    join: nodePath.join,
    normalize: nodePath.normalize,
    parse: (value) => ({ name: nodePath.parse(value).name }),
    relative: nodePath.relative,
    resolve: nodePath.resolve,
    fromFileUrl: fileURLToPath,
    toFileUrl: pathToFileURL,
  },
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd,
  homeDir: os.homedir,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync: (value) => readFileSync(value, "utf8"),
  readdirSync: (value) => readdirSync(value, { withFileTypes: true }),
  realpathSync,
  spawnSync(command, args, options = {}) {
    const result = nodeSpawnSync(command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      env: options.env as NodeJS.ProcessEnv | undefined,
      maxBuffer: options.maxBuffer,
      shell: options.shell,
      stdio: options.stdio,
    });
    return {
      status: result.status,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
      error: result.error,
    };
  },
  writeFileSync: (value, contents) => writeFileSync(value, contents),
  spawnAsync(command, args, options = {}) {
    return new Promise((resolve) => {
      const child = nodeSpawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: options.shell,
        stdio: options.stdio,
      });
      let stdout = "",
        stderr = "";
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
      child.once("error", (error) =>
        resolve({ status: null, stdout, stderr, error }),
      );
      child.once("close", (status) => resolve({ status, stdout, stderr }));
    });
  },
  watchPaths(paths, onChange, onError) {
    const watchers = paths.map((value) =>
      watch(value, { recursive: true }, onChange),
    );
    watchers.forEach((watcher) => watcher.on("error", onError));
    return () => watchers.forEach((watcher) => watcher.close());
  },
  removeSync: (value) => rmSync(value, { recursive: true, force: true }),
};

export function installNodePlatform(): void {
  installPlatform(nodePlatform);
}
