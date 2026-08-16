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

test("nested Storybook order preserves parent index pages under a specification-first group", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-order-"));
  try {
    mkdirSync(path.join(root, "spec/src/plugins"), { recursive: true });
    mkdirSync(path.join(root, "stories/spec/plugins"), { recursive: true });
    mkdirSync(path.join(root, ".storybook"), { recursive: true });
    writeFileSync(
      path.join(root, "spec/src/SUMMARY.md"),
      [
        "# Summary",
        "",
        "- [Introduction](./index.md)",
        "- [Plugins](./plugins/index.md)",
        "  - [Plugins / AI](./plugins/ai.md)",
        "",
      ].join("\n"),
    );
    writeFileSync(path.join(root, "spec/src/index.md"), "# Introduction\n");
    writeFileSync(path.join(root, "spec/src/plugins/index.md"), "# Plugins\n");
    writeFileSync(path.join(root, "spec/src/plugins/ai.md"), "# AI\n");
    const mirror = (target, title) =>
      `import { Markdown, Meta } from "@storybook/addon-docs/blocks";\nimport content from "${target}?raw";\n\n<Meta title="${title}" />\n\n<Markdown>{content}</Markdown>\n`;
    writeFileSync(
      path.join(root, "stories/spec/index.mdx"),
      mirror("../../spec/src/index.md", "Specification/Introduction"),
    );
    writeFileSync(
      path.join(root, "stories/spec/plugins/index.mdx"),
      mirror("../../../spec/src/plugins/index.md", "Specification/Plugins"),
    );
    writeFileSync(
      path.join(root, "stories/spec/plugins/ai.mdx"),
      mirror("../../../spec/src/plugins/ai.md", "Specification/Plugins/AI"),
    );
    writeFileSync(
      path.join(root, ".storybook/preview.ts"),
      `export default { options: { storySort: { order: ["Specification", ["Introduction", "Plugins", ["AI"]], "Plugins", "*"] } } };`,
    );
    const config = resolveConfig({
      ruleIds: {
        storybookMirrors: "FIX-CAT-001",
        internal: "FIX-GOV-001",
      },
      validators: {
        storybookMirrors: {
          style: "src-spec-mdx",
          directory: "stories/spec",
          titlePrefix: "Specification",
          verifyTarget: true,
          verifyTitle: true,
          verifyContent: true,
          previewPath: ".storybook/preview.ts",
          verifyOrder: true,
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

test("nested Storybook order ignores structural groups without SUMMARY chapters", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spec-validator-order-"));
  try {
    mkdirSync(path.join(root, "spec/src/shadcn"), { recursive: true });
    mkdirSync(path.join(root, "stories/spec/shadcn"), { recursive: true });
    mkdirSync(path.join(root, ".storybook"), { recursive: true });
    writeFileSync(
      path.join(root, "spec/src/SUMMARY.md"),
      [
        "# Summary",
        "",
        "- [Introduction](./index.md)",
        "- [Shadcn / Layout](./shadcn/layout.md)",
        "",
      ].join("\n"),
    );
    writeFileSync(path.join(root, "spec/src/index.md"), "# Introduction\n");
    writeFileSync(path.join(root, "spec/src/shadcn/layout.md"), "# Layout\n");
    const mirror = (target, title) =>
      `import { Markdown, Meta } from "@storybook/addon-docs/blocks";\nimport content from "${target}?raw";\n\n<Meta title="${title}" />\n\n<Markdown>{content}</Markdown>\n`;
    writeFileSync(
      path.join(root, "stories/spec/index.mdx"),
      mirror("../../spec/src/index.md", "Specification/Introduction"),
    );
    writeFileSync(
      path.join(root, "stories/spec/shadcn/layout.mdx"),
      mirror(
        "../../../spec/src/shadcn/layout.md",
        "Specification/Shadcn/Layout",
      ),
    );
    writeFileSync(
      path.join(root, ".storybook/preview.ts"),
      `export default { options: { storySort: { order: ["Specification", ["Introduction", "Shadcn", ["Layout"]], "*"] } } };`,
    );
    const config = resolveConfig({
      ruleIds: {
        storybookMirrors: "FIX-CAT-001",
        internal: "FIX-GOV-001",
      },
      validators: {
        storybookMirrors: {
          style: "src-spec-mdx",
          directory: "stories/spec",
          titlePrefix: "Specification",
          verifyTarget: true,
          verifyTitle: true,
          verifyContent: true,
          previewPath: ".storybook/preview.ts",
          verifyOrder: true,
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
