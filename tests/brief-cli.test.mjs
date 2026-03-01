import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const REPO_ROOT = new URL("../", import.meta.url).pathname;
const SCRIPT = `${REPO_ROOT}scripts/generate-brief.mjs`;
const SAMPLE = `${REPO_ROOT}examples/sample-input.json`;

test("brief CLI emits risk/dissent metrics in json mode", () => {
  const raw = execFileSync("node", [SCRIPT, "--input", SAMPLE, "--format", "json"], {
    encoding: "utf8",
  });

  const report = JSON.parse(raw);
  assert.equal(typeof report.constraintPenalty, "number");
  assert.equal(typeof report.advisorCount, "number");
  assert.equal(typeof report.varianceScore, "number");
  assert.ok(Array.isArray(report.riskMatrix));
  assert.ok(Array.isArray(report.dissentMap));
});

test("brief CLI fails fast on invalid enum values", () => {
  const invalidInput = JSON.stringify({
    question: "Should we ship now?",
    risk_tolerance: "extreme",
    time_horizon: "7d",
  });

  let failed = false;
  try {
    execFileSync("node", [SCRIPT, "--input", "/dev/stdin", "--format", "json"], {
      input: invalidInput,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    failed = true;
    assert.match(String(error.stderr || ""), /risk_tolerance/);
  }

  assert.equal(failed, true);
});
