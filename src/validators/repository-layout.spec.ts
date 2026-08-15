import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { validate } from "./repository-layout.js";

test("repository layout rejects exact untracked filesystem entries", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-layout-"));
  try {
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    mkdirSync(path.join(root, "specs"));
    const config = resolveConfig({
      ruleIds: {
        repositoryLayout: "FIX-GOV-001",
        internal: "FIX-GOV-001",
      },
      validators: {
        repositoryLayout: { forbiddenEntries: ["specs"] },
      },
    });
    const context = createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    });
    assert.deepEqual(validate(context), [
      {
        code: "SPEC-LAYOUT-FORBIDDEN",
        rule: "FIX-GOV-001",
        file: "specs",
        line: 1,
        subject: undefined,
        message: "filesystem entry is forbidden by repository layout policy",
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
