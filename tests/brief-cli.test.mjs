import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const REPO_ROOT = new URL("../", import.meta.url).pathname;
const SCRIPT = `${REPO_ROOT}scripts/generate-brief.mjs`;
const SAMPLE = `${REPO_ROOT}examples/sample-input.json`;
const SNAPSHOT = `${REPO_ROOT}tests/fixtures/brief-sample.snapshot.json`;

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

test("brief CLI matches snapshot for canonical sample", () => {
  const raw = execFileSync("node", [SCRIPT, "--input", SAMPLE, "--format", "json"], {
    encoding: "utf8",
  });

  const current = JSON.parse(raw);

  if (process.env.UPDATE_SNAPSHOT === "1") {
    fs.writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2));
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  assert.deepEqual(current, snapshot);
});

test("brief CLI follows output schema contract", () => {
  const raw = execFileSync("node", [SCRIPT, "--input", SAMPLE, "--format", "json"], {
    encoding: "utf8",
  });
  const report = JSON.parse(raw);

  const required = [
    "question",
    "riskTolerance",
    "timeHorizon",
    "direction",
    "confidence",
    "constraintsCount",
    "constraintPenalty",
    "urgencyScore",
    "actionBias",
    "recommendationWindow",
    "advisorCount",
    "varianceScore",
    "riskMatrix",
    "riskLevelCounts",
    "overallRiskLevel",
    "riskSummary",
    "dissentMap",
  ];

  for (const key of required) {
    assert.ok(Object.hasOwn(report, key), `missing key: ${key}`);
  }

  assert.ok(["low", "medium", "high"].includes(report.riskTolerance));
  assert.ok(["24h", "7d", "30d"].includes(report.timeHorizon));
  assert.ok(["conservative", "balanced", "aggressive"].includes(report.direction));
  assert.ok(["stabilize", "sequence", "act_now"].includes(report.actionBias));
  assert.ok(["next_24h", "this_week", "this_month"].includes(report.recommendationWindow));
  assert.equal(typeof report.urgencyScore, "number");
  assert.equal(Array.isArray(report.riskMatrix), true);
  assert.deepEqual(Object.keys(report.riskLevelCounts).sort(), ["high", "low", "medium"]);
  assert.ok(["low", "medium", "high"].includes(report.overallRiskLevel));
  assert.equal(typeof report.riskSummary, "string");
  assert.equal(Array.isArray(report.dissentMap), true);
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
