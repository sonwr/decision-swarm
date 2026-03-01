# decision-swarm

> **Multi-agent decision engine that makes disagreement explicit, measurable, and actionable.**

![Status](https://img.shields.io/badge/Status-Active_Development-0ea5e9)
![Domain](https://img.shields.io/badge/Domain-Decision_Intelligence-black)
![License](https://img.shields.io/badge/License-MIT-black)

## ◼ Background

Complex decisions fail less from lack of data and more from hidden assumptions, missing dissent, and unstructured tradeoffs.  
decision-swarm was initiated to formalize those blind spots.

## ◼ Mission

Transform one high-stakes question into a structured recommendation package with transparent disagreement, confidence boundaries, and risk-aware execution steps.

## ◼ Vision

A reusable decision substrate for engineering/product/operations contexts where multi-perspective reasoning is required and auditability matters.

## ◼ Philosophical Stance

- **Disagreement is signal, not noise.**
- **Confidence must be explicit.**
- **Recommendations are incomplete without mitigation paths.**

## ◼ Core Deliverables

| Deliverable | Description |
|---|---|
| Direction | recommended path + confidence band |
| Dissent map | where advisor views diverge |
| Risk matrix | top risk vectors + mitigations |
| Action windows | immediate (24h) and near-term (7d) actions |

## ◼ Architecture

```mermaid
flowchart LR
  Input[Decision Input Schema] --> Panel[Advisor Panel]
  Panel --> Agg[Aggregation Engine]
  Agg --> Report[Decision Report]
  Report --> MD[Markdown]
  Report --> JSON[JSON]
```

## ◼ MVP Scope

1. Input schema (`question`, `constraints`, `risk_tolerance`, `time_horizon`)
2. Parallel advisor execution
3. Consensus/divergence scoring
4. Multi-format report generation

## ◼ CLI Quickstart (MVP)

```bash
node scripts/generate-brief.mjs \
  --input examples/sample-input.json \
  --format both \
  --out /tmp/decision-brief.json

# invalid enum values fail fast with clear validation errors
# output also includes riskMatrix, dissentMap, advisorCount, varianceScore
# constraints can be string or { text, severity: low|medium|high }
```

## ◼ Test

```bash
npm test
npm run test:update-snapshot
```

Includes regression snapshot coverage for canonical brief output and output schema contract checks (`schemas/brief-output.schema.json`).
CI runs `npm test` and `scripts/ops-check.sh` on push/PR.
Ops-check also validates presence of `schemas/brief-output.schema.json` and key metric fields in CLI output.

## ◼ Operations Check

```bash
chmod +x scripts/ops-check.sh
./scripts/ops-check.sh
```

## ◼ Status

- [x] Repository bootstrap
- [ ] Execution engine
- [ ] Aggregation internals
- [x] CLI workflow (brief generator MVP)

## ◼ License

MIT (or project-defined license)
