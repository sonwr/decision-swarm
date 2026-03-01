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

function summarizeDirection(input) {
  const constraintsCount = Array.isArray(input.constraints) ? input.constraints.length : 0;
  const risk = toRiskScore(input.risk_tolerance);
  const horizon = toHorizonScore(input.time_horizon);
  const confidence = clamp(0.45 + horizon * 0.35 - constraintsCount * 0.05, 0.2, 0.9);

  const direction = risk >= 0.7
    ? "aggressive"
    : risk <= 0.45
      ? "conservative"
      : "balanced";

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
  };
}

function buildMarkdown(input, report) {
  const constraints = Array.isArray(input.constraints) ? input.constraints : [];
  const horizon = input.time_horizon || "7d";
  const risk = input.risk_tolerance || "medium";

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
    "",
    `## Constraints`,
    ...(constraints.length > 0 ? constraints.map((c) => `- ${c}`) : ["- none"]),
    "",
    `## Recommendation`,
    report.recommendation,
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
  const report = summarizeDirection(payload);

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
