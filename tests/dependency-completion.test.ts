import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (file: string) =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
test("Spec Validator remains a no-Lapis-input publisher until explicit intake qualification", () => {
  for (const file of [
    "package.json",
    "packages/workspace-tools/package.json",
  ]) {
    const manifest = JSON.parse(read(file));
    for (const section of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ])
      assert.deepEqual(
        Object.keys(manifest[section] ?? {}).filter((n) =>
          /^@(?:lapismd|lapis-notes)\//.test(n),
        ),
        [],
      );
  }
});
test("completion source is read-only, pinned, successful and cannot load candidate code", () => {
  const source = read(".github/workflows/dependency-completed.yml");
  assert.match(source, /workflows: \[Check\]/);
  assert.match(source, /github.event.workflow_run.conclusion == 'success'/);
  const pin = /completion.yml@([a-f0-9]{40})/.exec(source)?.[1];
  assert.ok(pin);
  assert.match(source, new RegExp(`automation-ref: ${pin}`));
  assert.match(
    source,
    /contents: read\n  actions: read\n  pull-requests: read/,
  );
  assert.match(
    source,
    /app-private-key: \$\{\{ secrets.LAPIS_DEPENDENCY_APP_PRIVATE_KEY \}\}/,
  );
  assert.doesNotMatch(
    source,
    /secrets: inherit|actions\/checkout|actions\/cache|download-artifact|: write/,
  );
  assert.equal((source.match(/Check/g) ?? []).length, 1);
});
