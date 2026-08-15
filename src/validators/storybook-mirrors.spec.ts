import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { validate } from "./storybook-mirrors.js";

test("stories-spec mirrors include non-list SUMMARY chapter links", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-mirror-"));
  try {
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    mkdirSync(path.join(root, "stories/spec"), { recursive: true });
    writeFileSync(
      path.join(root, "spec/src/SUMMARY.md"),
      "# Summary\n\n[System specification](index.md)\n",
    );
    writeFileSync(path.join(root, "spec/src/index.md"), "# System\n");
    writeFileSync(
      path.join(root, "stories/spec/System.mdx"),
      'import source from "../../spec/src/index.md?raw";\n',
    );
    const config = resolveConfig({
      ruleIds: {
        storybookMirrors: "FIX-CAT-001",
        internal: "FIX-GOV-001",
      },
      validators: {
        storybookMirrors: {
          style: "stories-spec",
          directory: "stories/spec",
        },
      },
    });
    const context = createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    });
    assert.deepEqual(validate(context), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
