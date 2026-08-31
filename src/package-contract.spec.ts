import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public package metadata names the canonical source and artifact files", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
    private?: boolean;
    repository?: { url?: string };
    homepage?: string;
    bugs?: { url?: string };
    publishConfig?: { access?: string; registry?: string };
    files?: string[];
  };

  assert.notEqual(manifest.private, true);
  assert.deepEqual(manifest.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org",
  });
  assert.equal(
    manifest.repository?.url,
    "git+https://github.com/lapismd/spec-validator.git",
  );
  assert.equal(manifest.homepage, "https://github.com/lapismd/spec-validator");
  assert.equal(
    manifest.bugs?.url,
    "https://github.com/lapismd/spec-validator/issues",
  );
  assert.deepEqual(manifest.files, [
    "dist/**/*",
    "skill/**/*",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ]);
});

test("trusted publication records the exact tag as a GitHub release", () => {
  const workflow = readFileSync(
    ".github/workflows/npm-publish.yml",
    "utf8",
  );

  assert.match(workflow, /release-notes:/);
  assert.match(workflow, /needs:\n\s+- package-gate\n\s+- verify-provenance/);
  assert.match(workflow, /if: needs\.verify-provenance\.result == 'success'/);
  assert.match(workflow, /gh release create "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /--verify-tag/);
  assert.match(workflow, /gh release view "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /--json isDraft/);
  assert.match(workflow, /--json isPrerelease/);
});
