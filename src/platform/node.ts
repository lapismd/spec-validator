import { spawnSync as nodeSpawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
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
};

export function installNodePlatform(): void {
  installPlatform(nodePlatform);
}
