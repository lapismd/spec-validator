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
    "git+https://code.ju.ma/lapismd/spec-validator.git",
  );
  assert.equal(manifest.homepage, "https://code.ju.ma/lapismd/spec-validator");
  assert.equal(
    manifest.bugs?.url,
    "https://code.ju.ma/lapismd/spec-validator/issues",
  );
  assert.deepEqual(manifest.files, [
    "dist/**/*",
    "skill/**/*",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ]);
});
