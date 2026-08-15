import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveConfig } from "../config.js";
import { createValidationContext } from "../context.js";
import { validate } from "./storybook-catalog.js";

function validateStory(source: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-story-"));
  try {
    const directory = path.join(root, "stories");
    mkdirSync(path.join(root, "spec/src"), { recursive: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "Example.stories.svelte"), source);
    const config = resolveConfig({
      ruleIds: {
        storybookCatalog: "FIX-CAT-001",
        internal: "FIX-GOV-001",
      },
      validators: {
        storybookCatalog: { roots: ["stories"] },
      },
    });
    const context = createValidationContext({
      repoRoot: root,
      config,
      trackedFiles: [],
    });
    return validate(context);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("Svelte CSF markup source objects satisfy story-only boundaries", () => {
  const findings = validateStory(`
<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import ExampleDemo from "./ExampleDemo.svelte";
  const { Story } = defineMeta({ title: "Example", component: ExampleDemo });
</script>

<Story
  name="Default"
  parameters={{
    docs: {
      source: {
        code: exampleSource,
        language: "tsx",
        type: "code",
      },
    },
  }}
/>
`);
  assert.deepEqual(findings, []);
});

test("Svelte CSF markup source objects retain field validation", () => {
  const findings = validateStory(`
<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import ExampleDemo from "./ExampleDemo.svelte";
  const { Story } = defineMeta({ title: "Example", component: ExampleDemo });
</script>

<Story parameters={{ docs: { source: { code: "<Example />" } } }} />
`);
  assert.deepEqual(
    findings.map((finding) => finding.code),
    ["SPEC-STORY-SOURCE-FIELDS"],
  );
});
