import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defineConfig,
  resolveConfig,
  resolveDiagnosticRule,
} from "./config.js";
import { headingRequirements } from "./profiles.js";

test("defineConfig composes neutral fragments and replaces validator options", () => {
  const user = defineConfig(headingRequirements(), {
    name: "fixture",
    idPattern: /^FIX-GOV-\d{3}$/,
    ruleIds: { governance: "FIX-GOV-001", internal: "FIX-GOV-001" },
    validators: { governance: { extras: ["README.md"] } },
  });
  const config = resolveConfig(user);
  assert.equal(config.name, "fixture");
  assert.deepEqual(
    config.validators.governance && config.validators.governance.extras,
    ["README.md"],
  );
  assert.equal(
    config.validators.governance && config.validators.governance.normative,
    true,
  );
});

test("false disables a validator enabled by an earlier profile", () => {
  const config = resolveConfig(
    defineConfig(headingRequirements(), {
      ruleIds: { internal: "FIX-GOV-001" },
      validators: { governance: false },
    }),
  );
  assert.equal(config.validators.governance, false);
});

test("enabled validators require consumer-owned rule mappings", () => {
  assert.throws(
    () =>
      resolveConfig({
        ruleIds: { internal: "FIX-GOV-001" },
        validators: { summary: true },
      }),
    /summary needs ruleIds\.summary/,
  );
});

test("exact diagnostic mappings override validator defaults", () => {
  const config = resolveConfig({
    ruleIds: {
      governance: "FIX-GOV-001",
      internal: "FIX-GOV-003",
    },
    diagnostics: { "SPEC-DETAILS-MISSING": "FIX-GOV-002" },
    validators: { governance: true },
  });
  assert.equal(
    resolveDiagnosticRule(config, "governance", "SPEC-DETAILS-MISSING"),
    "FIX-GOV-002",
  );
  assert.equal(
    resolveDiagnosticRule(config, "governance", "SPEC-REQ-DUPLICATE"),
    "FIX-GOV-001",
  );
});
