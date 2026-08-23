#!/usr/bin/env -S deno run

import { runCli } from "./cli-core.js";
import { installDenoPlatform } from "./platform/deno.js";

installDenoPlatform();

export { runCli };

if (import.meta.main) Deno.exit(await runCli());
