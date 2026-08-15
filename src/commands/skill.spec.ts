import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { globalSkillPath, installSkill } from "./skill.js";

test("skill install writes only the global Agents path", () => {
  const home = mkdtempSync(path.join(tmpdir(), "spec-validator-skill-"));
  const destination = installSkill(home);
  assert.equal(destination, globalSkillPath(home));
  assert.match(destination, /\.agents\/skills\/spec-validator\/SKILL\.md$/);
  assert.match(readFileSync(destination, "utf8"), /spec-validator search/);
});
