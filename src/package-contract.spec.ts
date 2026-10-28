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
    engines?: Record<string, string>;
    exports?: Record<string, unknown>;
    peerDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
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

test("the package stays pure Node without QMD or Deno runtime declarations", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
    engines?: Record<string, string>;
    exports?: Record<string, Record<string, string>>;
    peerDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  assert.deepEqual(manifest.engines, { node: ">=22" });
  const conditions = Object.values(manifest.exports?.["."] ?? {});
  assert.ok(!conditions.some((target) => target.includes("deno")));
  assert.equal(manifest.peerDependencies, undefined);
  assert.equal(manifest.dependencies?.["@tobilu/qmd"], undefined);
  for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
    assert.doesNotMatch(script, /\bdeno\b/u, `script ${name} mentions deno`);
  }
});

test("trusted publication records the exact tag as a GitHub release", () => {
  const workflow = readFileSync(".github/workflows/npm-publish.yml", "utf8");

  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.doesNotMatch(workflow, /\bdeno\b/iu);
  assert.match(workflow, /release-notes:/);
  assert.match(workflow, /needs:\n\s+- package-gate\n\s+- verify-provenance/);
  assert.match(workflow, /if: needs\.verify-provenance\.result == 'success'/);
  assert.match(workflow, /gh release create "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /--verify-tag/);
  assert.match(workflow, /gh release view "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /--json isDraft/);
  assert.match(workflow, /--json isPrerelease/);
});
