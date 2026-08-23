#!/usr/bin/env node

import { realpathSync } from "node:fs";
import nodePath from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runCli } from "./cli-core.js";
import { installNodePlatform } from "./platform/node.js";

installNodePlatform();

export { runCli };

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(nodePath.resolve(process.argv[1])) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
