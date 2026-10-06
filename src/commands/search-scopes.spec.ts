import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchCommand } from "./search.js";
import { createReporter } from "../reporter.js";
test("current scope defaults and semantic history embeds only the selected collection", async () => {
  const root = mkdtempSync(join(tmpdir(), "spec-scopes-"));
  try {
    mkdirSync(join(root, ".qmd"));
    mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
    writeFileSync(
      join(root, "spec-validator.config.json"),
      JSON.stringify({
        ruleIds: { qmd: "SV-QMD-001", internal: "SV-QMD-002" },
        validators: {
          qmd: {
            defaultScope: "current",
            scopes: {
              current: { collection: "current-spec", path: "spec/src/current" },
              history: { collection: "history-spec", path: "spec/src/history" },
            },
          },
        },
      }),
    );
    writeFileSync(join(root, ".qmd/index.yml"), "collections: {}\n");
    const binary = join(root, "node_modules/.bin/qmd");
    writeFileSync(
      binary,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> '${root}/calls'\n`,
    );
    chmodSync(binary, 0o755);
    const reporter = createReporter({ color: "never", json: false });
    assert.equal(
      await searchCommand(root, ["publication"], reporter, "search"),
      0,
    );
    assert.equal(
      await searchCommand(
        root,
        ["--semantic", "--scope", "history", "old blocker"],
        reporter,
        "search",
      ),
      0,
    );
    const calls = readFileSync(join(root, "calls"), "utf8");
    assert.match(calls, /search publication -c current-spec/);
    assert.match(calls, /embed -c history-spec/);
    assert.match(calls, /vsearch old blocker -c history-spec/);
    await assert.rejects(
      () =>
        searchCommand(
          root,
          ["--scope", "absent", "anything"],
          reporter,
          "search",
        ),
      /unknown search scope/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
