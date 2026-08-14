import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveConfig } from "./config.js";

test("resolveConfig applies the spec-validator preset", () => {
  const config = resolveConfig({ preset: "spec-validator" });
  assert.equal(config.preset, "spec-validator");
  assert.equal(config.validators.qmd !== false, true);
  assert.equal(config.validators.storybookCatalog, false);
  assert.equal(config.ruleIds.specFirst, "SV-GOV-004");
});

test("false disables a preset validator", () => {
  const config = resolveConfig({
    preset: "spec-validator",
    validators: { qmd: false },
  });
  assert.equal(config.validators.qmd, false);
  assert.equal(config.validators.book !== false, true);
});

test("unknown preset throws", () => {
  assert.throws(() => resolveConfig({ preset: "nope" }), /unknown preset/);
});
