import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveColorEnabled } from "./color.js";

test("color auto follows TTY and NO_COLOR", () => {
  assert.equal(resolveColorEnabled("auto", { isTTY: true }, {}), true);
  assert.equal(resolveColorEnabled("auto", { isTTY: false }, {}), false);
  assert.equal(resolveColorEnabled("auto", { isTTY: true }, { NO_COLOR: "1" }), false);
  assert.equal(resolveColorEnabled("never", { isTTY: true }, {}), false);
  assert.equal(resolveColorEnabled("always", { isTTY: false }, {}), true);
  assert.equal(resolveColorEnabled("auto", { isTTY: false }, { FORCE_COLOR: "1" }), true);
});
