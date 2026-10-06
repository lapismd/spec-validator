import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveConfig } from "./config.js";
import { stageBook } from "./book-staging.js";
import { watchBookSources } from "./book-serving.js";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
test("nested book builds complete navigation without rewriting authored sources", () => {
  const root = mkdtempSync(join(tmpdir(), "nested-book-"));
  try {
    mkdirSync(join(root, "spec/src/topic"), { recursive: true });
    const source =
      "# Summary\n\n- [Home](index.md)\n{{#include topic/SUMMARY.nav.md}}\n";
    writeFileSync(join(root, "spec/src/SUMMARY.md"), source);
    writeFileSync(join(root, "spec/src/index.md"), "# Home\n");
    writeFileSync(
      join(root, "spec/src/topic/SUMMARY.nav.md"),
      "- [Nested topic](index.md)\n",
    );
    writeFileSync(
      join(root, "spec/src/topic/index.md"),
      "# Nested topic\n\nExact nested content.\n",
    );
    writeFileSync(
      join(root, "spec/book.toml"),
      '[book]\ntitle = "Fixture"\nsrc = "src"\n[build]\nbuild-dir = "book"\ncreate-missing = false\n',
    );
    const config = resolveConfig({
      ruleIds: { internal: "SV-VAL-004", summary: "SV-VAL-004" },
      validators: { summary: { fragments: true } },
    });
    const stage = stageBook(root, config);
    execFileSync("mdbook", ["build", stage], { stdio: "pipe" });
    assert.match(
      readFileSync(join(root, "spec/book/topic/index.html"), "utf8"),
      /Exact nested content/,
    );
    assert.equal(
      readFileSync(join(root, "spec/src/SUMMARY.md"), "utf8"),
      source,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("nested serving rebuilds edited content and newly added navigation", async () => {
  const root = mkdtempSync(join(tmpdir(), "live-nested-book-"));
  mkdirSync(join(root, "spec/src/topic"), { recursive: true });
  writeFileSync(
    join(root, "spec/src/SUMMARY.md"),
    "# Summary\n\n- [Home](index.md)\n{{#include topic/SUMMARY.nav.md}}\n",
  );
  writeFileSync(join(root, "spec/src/index.md"), "# Home\n");
  writeFileSync(
    join(root, "spec/src/topic/SUMMARY.nav.md"),
    "- [Topic](index.md)\n",
  );
  writeFileSync(
    join(root, "spec/src/topic/index.md"),
    "# Topic\n\nOriginal content.\n",
  );
  writeFileSync(
    join(root, "spec/book.toml"),
    '[book]\ntitle = "Fixture"\nsrc = "src"\n[build]\nbuild-dir = "book"\ncreate-missing = false\n',
  );
  const config = resolveConfig({
    ruleIds: { internal: "SV-VAL-004", summary: "SV-VAL-004" },
    validators: { summary: { fragments: true } },
  });
  const stage = stageBook(root, config);
  const errors: Error[] = [];
  const stop = watchBookSources(root, config, (error) => errors.push(error));
  const port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("missing port");
      server.close(() => resolve(address.port));
    });
  });
  const child = spawn(
    "mdbook",
    ["serve", stage, "--hostname", "127.0.0.1", "--port", String(port)],
    { stdio: "ignore" },
  );
  const exited = new Promise<void>((resolve) =>
    child.once("exit", () => resolve()),
  );
  async function waitFor(page: string, content: string) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        if (
          (
            await (await fetch(`http://127.0.0.1:${port}/${page}`)).text()
          ).includes(content)
        )
          return;
      } catch {
        /* startup */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      `served ${page} did not include ${content}; errors: ${errors}`,
    );
  }
  try {
    await waitFor("topic/index.html", "Original content");
    writeFileSync(
      join(root, "spec/src/topic/index.md"),
      "# Topic\n\nUpdated content.\n",
    );
    await waitFor("topic/index.html", "Updated content");
    writeFileSync(
      join(root, "spec/src/topic/added.md"),
      "# Added\n\nNew navigation content.\n",
    );
    writeFileSync(
      join(root, "spec/src/topic/SUMMARY.nav.md"),
      "- [Topic](index.md)\n- [Added](added.md)\n",
    );
    await waitFor("topic/added.html", "New navigation content");
    rmSync(join(root, "spec/src/topic/added.md"));
    writeFileSync(
      join(root, "spec/src/topic/SUMMARY.nav.md"),
      "- [Topic](index.md)\n",
    );
    const deletionDeadline = Date.now() + 5000;
    while (
      Date.now() < deletionDeadline &&
      readFileSync(join(stage, "src/SUMMARY.md"), "utf8").includes("added.md")
    )
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.doesNotMatch(
      readFileSync(join(stage, "src/SUMMARY.md"), "utf8"),
      /added\.md/,
    );
    assert.throws(
      () => readFileSync(join(stage, "src/topic/added.md")),
      /ENOENT/,
    );
    assert.deepEqual(errors, []);
    assert.match(
      readFileSync(join(root, "spec/src/SUMMARY.md"), "utf8"),
      /\{\{#include/,
    );
  } finally {
    stop();
    child.kill();
    await exited;
    rmSync(root, { recursive: true, force: true });
  }
});
