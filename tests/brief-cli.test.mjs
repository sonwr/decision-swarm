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
    "constraintSeverityCounts",
    "urgencyScore",
    "actionBias",
    "urgencyBand",
    "recommendationWindow",
    "advisorCount",
    "varianceScore",
    "riskMatrix",
    "riskLevelCounts",
    "overallRiskLevel",
    "riskSummary",
    "riskHotspots",
    "dissentMap",
  ];

  for (const key of required) {
    assert.ok(Object.hasOwn(report, key), `missing key: ${key}`);
  }

  assert.ok(["low", "medium", "high"].includes(report.riskTolerance));
  assert.ok(["24h", "7d", "30d"].includes(report.timeHorizon));
  assert.ok(["conservative", "balanced", "aggressive"].includes(report.direction));
  assert.deepEqual(Object.keys(report.constraintSeverityCounts).sort(), ["high", "low", "medium"]);
  assert.ok(["stabilize", "sequence", "act_now"].includes(report.actionBias));
  assert.ok(["baseline", "elevated", "critical"].includes(report.urgencyBand));
  assert.ok(["next_24h", "this_week", "this_month"].includes(report.recommendationWindow));
  assert.equal(typeof report.urgencyScore, "number");
  assert.equal(Array.isArray(report.riskMatrix), true);
  assert.deepEqual(Object.keys(report.riskLevelCounts).sort(), ["high", "low", "medium"]);
  assert.ok(["low", "medium", "high"].includes(report.overallRiskLevel));
  assert.equal(typeof report.riskSummary, "string");
  assert.equal(Array.isArray(report.riskHotspots), true);
  assert.equal(Array.isArray(report.dissentMap), true);
});

test("brief CLI supports constraints_csv as a compact input format", () => {
  const input = JSON.stringify({
    question: "Should we ship now?",
    constraints_csv: "keep rollback path; preserve budget, avoid downtime",
    risk_tolerance: "medium",
    time_horizon: "7d",
  });

  const raw = execFileSync("node", [SCRIPT, "--input", "/dev/stdin", "--format", "json"], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const report = JSON.parse(raw);
  assert.equal(report.constraintsCount, 3);
  assert.equal(report.constraintSeverityCounts.medium, 3);
});

test("brief CLI accepts constraints via --constraints-csv flag", () => {
  const input = JSON.stringify({
    question: "Should we ship now?",
    risk_tolerance: "medium",
    time_horizon: "7d",
  });

  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", "/dev/stdin", "--format", "json", "--constraints-csv", "latency<200ms; preserve budget"],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const report = JSON.parse(raw);
  assert.equal(report.constraintsCount, 2);
  assert.equal(report.constraintSeverityCounts.medium, 2);
});

test("brief CLI applies --question-prefix to output question", () => {
  const input = JSON.stringify({
    question: "Should we ship now?",
    risk_tolerance: "medium",
    time_horizon: "7d",
  });

  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", "/dev/stdin", "--format", "json", "--question-prefix", "[P0]"],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const report = JSON.parse(raw);
  assert.equal(report.question, "[P0] Should we ship now?");
});

test("brief CLI applies --question-suffix to output question", () => {
  const input = JSON.stringify({
    question: "Should we ship now?",
    risk_tolerance: "medium",
    time_horizon: "7d",
  });

  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", "/dev/stdin", "--format", "json", "--question-suffix", "(owner: growth-team)"],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const report = JSON.parse(raw);
  assert.equal(report.question, "Should we ship now? (owner: growth-team)");
});

test("brief CLI applies --risk-override to replace input risk tolerance", () => {
  const input = JSON.stringify({
    question: "Should we ship now?",
    risk_tolerance: "low",
    time_horizon: "7d",
  });

  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", "/dev/stdin", "--format", "json", "--risk-override", "high"],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const report = JSON.parse(raw);
  assert.equal(report.riskTolerance, "high");
  assert.equal(report.direction, "aggressive");
});

test("brief CLI applies --markdown-title in markdown output", () => {
  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", SAMPLE, "--format", "md", "--markdown-title", "Decision Brief (P0)"],
    {
      encoding: "utf8",
    },
  );

  assert.match(raw, /^# Decision Brief \(P0\)/);
});

test("brief CLI can omit risk section in markdown output", () => {
  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", SAMPLE, "--format", "md", "--omit-risk"],
    {
      encoding: "utf8",
    },
  );

  assert.doesNotMatch(raw, /## Risk matrix/);
  assert.match(raw, /## Dissent map/);
});

test("brief CLI can omit dissent section in markdown output", () => {
  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", SAMPLE, "--format", "md", "--omit-dissent"],
    {
      encoding: "utf8",
    },
  );

  assert.match(raw, /## Risk matrix/);
  assert.doesNotMatch(raw, /## Dissent map/);
});

test("brief CLI can customize action window text in markdown output", () => {
  const raw = execFileSync(
    "node",
    [
      SCRIPT,
      "--input",
      SAMPLE,
      "--format",
      "md",
      "--action-window-24h",
      "run one canary experiment",
      "--action-window-7d",
      "finalize go/no-go with explicit KPIs",
      "--action-window-30d",
      "bake wins into team playbooks",
    ],
    {
      encoding: "utf8",
    },
  );

  assert.match(raw, /- Next 24h: run one canary experiment/);
  assert.match(raw, /- Next 7d: finalize go\/no-go with explicit KPIs/);
  assert.match(raw, /- Next 30d: bake wins into team playbooks/);
});

test("brief CLI can omit action windows section in markdown output", () => {
  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", SAMPLE, "--format", "md", "--omit-action-windows"],
    {
      encoding: "utf8",
    },
  );

  assert.doesNotMatch(raw, /## Action windows/);
  assert.doesNotMatch(raw, /- Next 24h:/);
  assert.doesNotMatch(raw, /- Next 7d:/);
  assert.doesNotMatch(raw, /- Next 30d:/);
});

test("brief CLI applies --horizon-override to replace input time horizon", () => {
  const input = JSON.stringify({
    question: "Should we ship now?",
    risk_tolerance: "medium",
    time_horizon: "30d",
  });

  const raw = execFileSync(
    "node",
    [SCRIPT, "--input", "/dev/stdin", "--format", "json", "--horizon-override", "24h"],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const report = JSON.parse(raw);
  assert.equal(report.timeHorizon, "24h");
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
