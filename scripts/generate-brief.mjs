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

  if (payload.constraints_csv !== undefined && typeof payload.constraints_csv !== "string") {
    errors.push("constraints_csv must be a string when provided");
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

  if (payload.urgency_multiplier !== undefined) {
    const value = Number(payload.urgency_multiplier);
    if (!Number.isFinite(value)) {
      errors.push("urgency_multiplier must be a finite number when provided");
    }
  }

  return errors;
}


function parseConstraintCsv(rawCsv) {
  if (typeof rawCsv !== "string") {
    return [];
  }

  return rawCsv
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeConstraints(rawConstraints, rawConstraintCsv) {
  const mergedConstraints = [
    ...(Array.isArray(rawConstraints) ? rawConstraints : []),
    ...parseConstraintCsv(rawConstraintCsv),
  ];

  return mergedConstraints
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

function summarizeConstraintSeverities(constraints) {
  return constraints.reduce((acc, constraint) => {
    if (constraint.severity === "high") acc.high += 1;
    else if (constraint.severity === "low") acc.low += 1;
    else acc.medium += 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });
}

function summarizeDirection(input) {
  const constraints = normalizeConstraints(input.constraints, input.constraints_csv);
  const constraintsCount = constraints.length;
  const risk = toRiskScore(input.risk_tolerance);
  const horizon = toHorizonScore(input.time_horizon);
  const constraintPenalty = toConstraintPenalty(constraints);
  const constraintSeverityCounts = summarizeConstraintSeverities(constraints);
  const urgencyMultiplier = Number.isFinite(Number(input.urgency_multiplier))
    ? clamp(Number(input.urgency_multiplier), 0.5, 1.5)
    : 1;
  const confidence = clamp(0.45 + horizon * 0.35 - constraintPenalty, 0.2, 0.9);

  const direction = risk >= 0.7
    ? "aggressive"
    : risk <= 0.45
      ? "conservative"
      : "balanced";

  const baseUrgency = (risk * 0.55) + ((1 - horizon) * 0.35) + (constraintPenalty * 0.9);
  const urgencyScore = clamp(baseUrgency * urgencyMultiplier, 0.1, 0.95);
  const urgencyBand = urgencyScore >= 0.75
    ? "critical"
    : urgencyScore >= 0.5
      ? "elevated"
      : "baseline";
  const actionBias = urgencyScore >= 0.67
    ? "act_now"
    : urgencyScore <= 0.42
      ? "stabilize"
      : "sequence";
  const recommendationWindow = urgencyScore >= 0.75
    ? "next_24h"
    : urgencyScore >= 0.5
      ? "this_week"
      : "this_month";

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
    constraintSeverityCounts,
    urgencyScore: Number(urgencyScore.toFixed(2)),
    urgencyMultiplier: Number(urgencyMultiplier.toFixed(2)),
    actionBias,
    urgencyBand,
    recommendationWindow,
  };
}


function buildRiskMatrix(input, report) {
  const constraints = normalizeConstraints(input.constraints, input.constraints_csv);

  const executionRisk = report.direction === "aggressive" ? "high" : report.direction === "balanced" ? "medium" : "low";
  const rollbackRisk = report.direction === "conservative" ? "low" : "medium";
  const alignmentRisk = constraints.length >= 3 ? "high" : constraints.length >= 1 ? "medium" : "low";

  return [
    { vector: "execution_speed", level: executionRisk, mitigation: "use canary rollout and short feedback intervals" },
    { vector: "rollback_complexity", level: rollbackRisk, mitigation: "prepare explicit rollback runbook before release" },
    { vector: "constraint_alignment", level: alignmentRisk, mitigation: "convert constraints into measurable acceptance checks" },
  ];
}

function summarizeRiskMatrix(riskMatrix) {
  const counters = { low: 0, medium: 0, high: 0 };

  for (const entry of riskMatrix || []) {
    if (entry?.level === "low") counters.low += 1;
    else if (entry?.level === "high") counters.high += 1;
    else counters.medium += 1;
  }

  const overall = counters.high > 0
    ? "high"
    : counters.medium > 0
      ? "medium"
      : "low";

  const riskSummary = overall === "high"
    ? `High-risk profile (${counters.high} high vectors).`
    : overall === "medium"
      ? `Medium-risk profile (${counters.medium} medium vectors, ${counters.high} high vectors).`
      : "Low-risk profile (no medium/high vectors).";

  const riskHotspots = (riskMatrix || [])
    .filter((entry) => entry?.level === "high")
    .map((entry) => entry.vector);

  return {
    riskLevelCounts: counters,
    overallRiskLevel: overall,
    riskSummary,
    riskHotspots,
  };
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

function buildMarkdown(input, report, options = {}) {
  const constraints = normalizeConstraints(input.constraints, input.constraints_csv);
  const horizon = input.time_horizon || "7d";
  const risk = input.risk_tolerance || "medium";
  const riskMatrix = report.riskMatrix || [];
  const dissentMap = report.dissentMap || [];
  const omitRisk = options.omitRisk === true;
  const omitDissent = options.omitDissent === true;
  const omitActionWindows = options.omitActionWindows === true;
  const actionWindow24h = typeof options.actionWindow24h === "string" && options.actionWindow24h.trim().length > 0
    ? options.actionWindow24h.trim()
    : "validate assumptions with one low-cost experiment.";
  const actionWindow7d = typeof options.actionWindow7d === "string" && options.actionWindow7d.trim().length > 0
    ? options.actionWindow7d.trim()
    : "commit or rollback based on explicit success thresholds.";
  const actionWindow14d = typeof options.actionWindow14d === "string" && options.actionWindow14d.trim().length > 0
    ? options.actionWindow14d.trim()
    : "harden successful experiments and retire weak bets.";
  const actionWindow30d = typeof options.actionWindow30d === "string" && options.actionWindow30d.trim().length > 0
    ? options.actionWindow30d.trim()
    : "operationalize learnings and lock durable guardrails.";

  const markdownTitle = typeof options.markdownTitle === "string" && options.markdownTitle.trim().length > 0
    ? options.markdownTitle.trim()
    : "Decision Brief";

  const riskSection = omitRisk
    ? []
    : [
      `## Risk matrix`,
      `- overall: ${report.overallRiskLevel ?? "medium"}`,
      `- summary: ${report.riskSummary ?? ""}`,
      `- hotspots: ${(report.riskHotspots || []).join(", ") || "none"}`,
      ...(riskMatrix.length > 0
        ? riskMatrix.map((entry) => `- ${entry.vector}: ${entry.level} (mitigation: ${entry.mitigation})`)
        : ["- none"]),
      "",
    ];

  const dissentSection = omitDissent
    ? []
    : [
      `## Dissent map`,
      `- advisor count: ${report.advisorCount ?? 0}`,
      `- variance score: ${report.varianceScore ?? 0}`,
      ...(dissentMap.length > 0
        ? dissentMap.map((entry) => `- ${entry.advisor}: ${entry.stance} (confidence: ${entry.confidence})`)
        : ["- none"]),
      "",
    ];

  const actionWindowSection = omitActionWindows
    ? []
    : [
      `## Action windows`,
      `- Next 24h: ${actionWindow24h}`,
      `- Next 7d: ${actionWindow7d}`,
      `- Next 14d: ${actionWindow14d}`,
      `- Next 30d: ${actionWindow30d}`,
      "",
    ];

  return [
    `# ${markdownTitle}`,
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
    `- **Urgency multiplier:** ${report.urgencyMultiplier ?? 1}`,
    `- **Action bias:** ${report.actionBias ?? "sequence"}`,
    `- **Urgency band:** ${report.urgencyBand ?? "baseline"}`,
    `- **Recommendation window:** ${report.recommendationWindow ?? "this_week"}`,
    "",
    `## Constraints`,
    ...(constraints.length > 0 ? constraints.map((c) => `- ${c.text} [severity: ${c.severity}]`) : ["- none"]),
    "",
    `## Recommendation`,
    report.recommendation,
    "",
    ...riskSection,
    ...dissentSection,
    ...actionWindowSection,
  ].join("\n");
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function parseArgs(argv) {
  const args = { input: "", format: "json", out: "", constraintsCsv: "", questionPrefix: "", questionSuffix: "", markdownTitle: "", omitRisk: false, omitDissent: false, omitActionWindows: false, actionWindow24h: "", actionWindow7d: "", actionWindow14d: "", actionWindow30d: "", riskOverride: "", horizonOverride: "", urgencyMultiplier: "", jsonPretty: true, jsonSortKeys: false, jsonIndent: 2 };

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
    } else if (token === "--constraints-csv") {
      args.constraintsCsv = argv[i + 1] || "";
      i += 1;
    } else if (token === "--question-prefix") {
      args.questionPrefix = argv[i + 1] || "";
      i += 1;
    } else if (token === "--question-suffix") {
      args.questionSuffix = argv[i + 1] || "";
      i += 1;
    } else if (token === "--markdown-title") {
      args.markdownTitle = argv[i + 1] || "";
      i += 1;
    } else if (token === "--omit-risk") {
      args.omitRisk = true;
    } else if (token === "--omit-dissent") {
      args.omitDissent = true;
    } else if (token === "--omit-action-windows") {
      args.omitActionWindows = true;
    } else if (token === "--action-window-24h") {
      args.actionWindow24h = argv[i + 1] || "";
      i += 1;
    } else if (token === "--action-window-7d") {
      args.actionWindow7d = argv[i + 1] || "";
      i += 1;
    } else if (token === "--action-window-14d") {
      args.actionWindow14d = argv[i + 1] || "";
      i += 1;
    } else if (token === "--action-window-30d") {
      args.actionWindow30d = argv[i + 1] || "";
      i += 1;
    } else if (token === "--risk-override") {
      args.riskOverride = argv[i + 1] || "";
      i += 1;
    } else if (token === "--horizon-override") {
      args.horizonOverride = argv[i + 1] || "";
      i += 1;
    } else if (token === "--urgency-multiplier") {
      args.urgencyMultiplier = argv[i + 1] || "";
      i += 1;
    } else if (token === "--json-compact") {
      args.jsonPretty = false;
    } else if (token === "--json-sort-keys") {
      args.jsonSortKeys = true;
    } else if (token === "--json-indent") {
      const parsedIndent = Number(argv[i + 1]);
      args.jsonIndent = Number.isFinite(parsedIndent) ? Math.min(Math.max(Math.round(parsedIndent), 0), 8) : 2;
      i += 1;
    }
  }

  return args;
}

function main() {
  const { input, format, out, constraintsCsv, questionPrefix, questionSuffix, markdownTitle, omitRisk, omitDissent, omitActionWindows, actionWindow24h, actionWindow7d, actionWindow14d, actionWindow30d, riskOverride, horizonOverride, urgencyMultiplier, jsonPretty, jsonSortKeys, jsonIndent } = parseArgs(process.argv);
  if (!input) {
    console.error("Usage: node scripts/generate-brief.mjs --input <json-file> [--format json|md|both] [--out <file>] [--question-prefix <text>] [--question-suffix <text>]");
    process.exit(1);
  }

  const raw = fs.readFileSync(input, "utf8");
  const payload = JSON.parse(raw);

  if (constraintsCsv && !payload.constraints_csv) {
    payload.constraints_csv = constraintsCsv;
  }

  if (questionPrefix && typeof payload.question === "string" && payload.question.trim().length > 0) {
    payload.question = `${questionPrefix.trim()} ${payload.question}`.trim();
  }

  if (questionSuffix && typeof payload.question === "string" && payload.question.trim().length > 0) {
    payload.question = `${payload.question} ${questionSuffix.trim()}`.trim();
  }

  if (riskOverride) {
    payload.risk_tolerance = riskOverride;
  }

  if (horizonOverride) {
    payload.time_horizon = horizonOverride;
  }

  if (urgencyMultiplier) {
    payload.urgency_multiplier = urgencyMultiplier;
  }

  const validationErrors = validateInput(payload);
  if (validationErrors.length > 0) {
    console.error(`Invalid input: ${validationErrors.join("; ")}`);
    process.exit(1);
  }

  const baseReport = summarizeDirection(payload);
  const dissentMap = buildDissentMap(payload, baseReport);
  const dissentMetrics = buildDissentMetrics(dissentMap);

  const riskMatrix = buildRiskMatrix(payload, baseReport);

  const report = {
    ...baseReport,
    riskMatrix,
    ...summarizeRiskMatrix(riskMatrix),
    dissentMap,
    ...dissentMetrics,
  };

  const jsonResult = {
    question: payload.question || "",
    riskTolerance: payload.risk_tolerance || "medium",
    timeHorizon: payload.time_horizon || "7d",
    ...report,
  };

  const mdResult = buildMarkdown(payload, report, {
    markdownTitle,
    omitRisk,
    omitDissent,
    omitActionWindows,
    actionWindow24h,
    actionWindow7d,
    actionWindow14d,
    actionWindow30d,
  });

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
    const serializable = jsonSortKeys ? sortKeysDeep(bothResult) : bothResult;
    const rendered = JSON.stringify(serializable, null, jsonPretty ? jsonIndent : 0);
    if (out) {
      fs.writeFileSync(out, rendered, "utf8");
    }
    process.stdout.write(rendered);
    return;
  }

  const serializable = jsonSortKeys ? sortKeysDeep(jsonResult) : jsonResult;
  const rendered = JSON.stringify(serializable, null, jsonPretty ? jsonIndent : 0);
  if (out) {
    fs.writeFileSync(out, rendered, "utf8");
  }
  process.stdout.write(rendered);
}

main();
