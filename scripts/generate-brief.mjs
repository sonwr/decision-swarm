#!/usr/bin/env node

/**
 * decision-swarm brief generator (MVP utility)
 *
 * Input JSON:
 * {
 *   "question": "...",
 *   "constraints": ["..."],
 *   "risk_tolerance": "low|medium|high",
 *   "time_horizon": "24h|7d|30d"
 * }
 */

import fs from "node:fs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRiskScore(riskTolerance = "medium") {
  const key = String(riskTolerance).toLowerCase();
  if (key === "low") return 0.35;
  if (key === "high") return 0.8;
  return 0.6;
}

function toHorizonScore(timeHorizon = "7d") {
  const key = String(timeHorizon).toLowerCase();
  if (key === "24h") return 0.45;
  if (key === "30d") return 0.75;
  return 0.6;
}


function validateInput(payload) {
  const errors = [];

  if (typeof payload !== "object" || payload === null) {
    return ["input must be a JSON object"];
  }

  if (typeof payload.question !== "string" || payload.question.trim().length === 0) {
    errors.push("question must be a non-empty string");
  }

  if (payload.constraints !== undefined && !Array.isArray(payload.constraints)) {
    errors.push("constraints must be an array of strings when provided");
  }

  if (Array.isArray(payload.constraints) && payload.constraints.some((item) => {
    if (typeof item === "string") return false;
    return !(typeof item === "object" && item !== null && typeof item.text === "string");
  })) {
    errors.push("constraints entries must be strings or objects with { text, severity? }");
  }

  const allowedRisk = new Set(["low", "medium", "high"]);
  if (payload.risk_tolerance !== undefined && !allowedRisk.has(String(payload.risk_tolerance).toLowerCase())) {
    errors.push("risk_tolerance must be one of: low, medium, high");
  }

  const allowedHorizon = new Set(["24h", "7d", "30d"]);
  if (payload.time_horizon !== undefined && !allowedHorizon.has(String(payload.time_horizon).toLowerCase())) {
    errors.push("time_horizon must be one of: 24h, 7d, 30d");
  }

  return errors;
}


function normalizeConstraints(rawConstraints) {
  if (!Array.isArray(rawConstraints)) {
    return [];
  }

  return rawConstraints
    .map((entry) => {
      if (typeof entry === "string") {
        return { text: entry, severity: "medium" };
      }

      if (typeof entry === "object" && entry !== null && typeof entry.text === "string") {
        const severity = String(entry.severity || "medium").toLowerCase();
        return {
          text: entry.text,
          severity: ["low", "medium", "high"].includes(severity) ? severity : "medium",
        };
      }

      return null;
    })
    .filter(Boolean);
}

function toConstraintPenalty(constraints) {
  return constraints.reduce((acc, constraint) => {
    if (constraint.severity === "high") return acc + 0.08;
    if (constraint.severity === "low") return acc + 0.03;
    return acc + 0.05;
  }, 0);
}

function summarizeDirection(input) {
  const constraints = normalizeConstraints(input.constraints);
  const constraintsCount = constraints.length;
  const risk = toRiskScore(input.risk_tolerance);
  const horizon = toHorizonScore(input.time_horizon);
  const constraintPenalty = toConstraintPenalty(constraints);
  const confidence = clamp(0.45 + horizon * 0.35 - constraintPenalty, 0.2, 0.9);

  const direction = risk >= 0.7
    ? "aggressive"
    : risk <= 0.45
      ? "conservative"
      : "balanced";

  const urgencyScore = clamp((risk * 0.55) + ((1 - horizon) * 0.35) + (constraintPenalty * 0.9), 0.1, 0.95);
  const actionBias = urgencyScore >= 0.67
    ? "act_now"
    : urgencyScore <= 0.42
      ? "stabilize"
      : "sequence";

  const recommendation = direction === "aggressive"
    ? "Prioritize speed, accept bounded downside, and add short feedback loops."
    : direction === "conservative"
      ? "Prioritize reversibility, guardrail checks, and staged rollout."
      : "Balance execution speed with explicit rollback and review gates.";

  return {
    direction,
    confidence: Number(confidence.toFixed(2)),
    recommendation,
    constraintsCount,
    constraintPenalty: Number(constraintPenalty.toFixed(2)),
    urgencyScore: Number(urgencyScore.toFixed(2)),
    actionBias,
  };
}


function buildRiskMatrix(input, report) {
  const constraints = normalizeConstraints(input.constraints);

  const executionRisk = report.direction === "aggressive" ? "high" : report.direction === "balanced" ? "medium" : "low";
  const rollbackRisk = report.direction === "conservative" ? "low" : "medium";
  const alignmentRisk = constraints.length >= 3 ? "high" : constraints.length >= 1 ? "medium" : "low";

  return [
    { vector: "execution_speed", level: executionRisk, mitigation: "use canary rollout and short feedback intervals" },
    { vector: "rollback_complexity", level: rollbackRisk, mitigation: "prepare explicit rollback runbook before release" },
    { vector: "constraint_alignment", level: alignmentRisk, mitigation: "convert constraints into measurable acceptance checks" },
  ];
}

function buildDissentMap(input, report) {
  const risk = String(input.risk_tolerance || "medium").toLowerCase();

  if (risk === "high") {
    return [
      { advisor: "speed-advocate", stance: "push launch in this cycle", confidence: 0.74 },
      { advisor: "risk-guardian", stance: "allow launch only with kill-switch and canary", confidence: 0.62 },
    ];
  }

  if (risk === "low") {
    return [
      { advisor: "risk-guardian", stance: "defer launch until reversibility checks are complete", confidence: 0.76 },
      { advisor: "speed-advocate", stance: "ship a reduced scope behind a flag", confidence: 0.55 },
    ];
  }

  return [
    { advisor: "balance-operator", stance: "ship progressively with rollback guardrails", confidence: 0.71 },
    { advisor: "speed-advocate", stance: "optimize for iteration speed after first canary", confidence: 0.58 },
  ];
}


function buildDissentMetrics(dissentMap) {
  const confidences = dissentMap
    .map((entry) => Number(entry.confidence))
    .filter((value) => Number.isFinite(value));

  if (confidences.length === 0) {
    return { advisorCount: 0, varianceScore: 0 };
  }

  const avg = confidences.reduce((acc, value) => acc + value, 0) / confidences.length;
  const variance = confidences.reduce((acc, value) => acc + ((value - avg) ** 2), 0) / confidences.length;

  return {
    advisorCount: confidences.length,
    varianceScore: Number(Math.sqrt(variance).toFixed(3)),
  };
}

function buildMarkdown(input, report) {
  const constraints = normalizeConstraints(input.constraints);
  const horizon = input.time_horizon || "7d";
  const risk = input.risk_tolerance || "medium";
  const riskMatrix = report.riskMatrix || [];
  const dissentMap = report.dissentMap || [];

  return [
    `# Decision Brief`,
    "",
    `## Question`,
    `${input.question || "(missing question)"}`,
    "",
    `## Direction`,
    `- **Mode:** ${report.direction}`,
    `- **Confidence:** ${report.confidence}`,
    `- **Risk tolerance:** ${risk}`,
    `- **Time horizon:** ${horizon}`,
    `- **Urgency score:** ${report.urgencyScore ?? 0}`,
    `- **Action bias:** ${report.actionBias ?? "sequence"}`,
    "",
    `## Constraints`,
    ...(constraints.length > 0 ? constraints.map((c) => `- ${c.text} [severity: ${c.severity}]`) : ["- none"]),
    "",
    `## Recommendation`,
    report.recommendation,
    "",
    `## Risk matrix`,
    ...(riskMatrix.length > 0
      ? riskMatrix.map((entry) => `- ${entry.vector}: ${entry.level} (mitigation: ${entry.mitigation})`)
      : ["- none"]),
    "",
    `## Dissent map`,
    `- advisor count: ${report.advisorCount ?? 0}`,
    `- variance score: ${report.varianceScore ?? 0}`,
    ...(dissentMap.length > 0
      ? dissentMap.map((entry) => `- ${entry.advisor}: ${entry.stance} (confidence: ${entry.confidence})`)
      : ["- none"]),
    "",
    `## Action windows`,
    `- Next 24h: validate assumptions with one low-cost experiment.`,
    `- Next 7d: commit or rollback based on explicit success thresholds.`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: "", format: "json", out: "" };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      args.input = argv[i + 1] || "";
      i += 1;
    } else if (token === "--format") {
      args.format = argv[i + 1] || "json";
      i += 1;
    } else if (token === "--out") {
      args.out = argv[i + 1] || "";
      i += 1;
    }
  }

  return args;
}

function main() {
  const { input, format, out } = parseArgs(process.argv);
  if (!input) {
    console.error("Usage: node scripts/generate-brief.mjs --input <json-file> [--format json|md|both] [--out <file>]");
    process.exit(1);
  }

  const raw = fs.readFileSync(input, "utf8");
  const payload = JSON.parse(raw);
  const validationErrors = validateInput(payload);
  if (validationErrors.length > 0) {
    console.error(`Invalid input: ${validationErrors.join("; ")}`);
    process.exit(1);
  }

  const baseReport = summarizeDirection(payload);
  const dissentMap = buildDissentMap(payload, baseReport);
  const dissentMetrics = buildDissentMetrics(dissentMap);

  const report = {
    ...baseReport,
    riskMatrix: buildRiskMatrix(payload, baseReport),
    dissentMap,
    ...dissentMetrics,
  };

  const jsonResult = {
    question: payload.question || "",
    riskTolerance: payload.risk_tolerance || "medium",
    timeHorizon: payload.time_horizon || "7d",
    ...report,
  };

  const mdResult = buildMarkdown(payload, report);

  if (format === "md") {
    if (out) {
      fs.writeFileSync(out, mdResult, "utf8");
    }
    process.stdout.write(mdResult);
    return;
  }

  if (format === "both") {
    const bothResult = {
      ...jsonResult,
      markdown: mdResult,
    };
    const rendered = JSON.stringify(bothResult, null, 2);
    if (out) {
      fs.writeFileSync(out, rendered, "utf8");
    }
    process.stdout.write(rendered);
    return;
  }

  const rendered = JSON.stringify(jsonResult, null, 2);
  if (out) {
    fs.writeFileSync(out, rendered, "utf8");
  }
  process.stdout.write(rendered);
}

main();
