# decision-swarm

A multi-agent decision support system that turns one hard question into many perspectives, then summarizes statistical direction, disagreement, and risk.

## Problem

Most people decide with 1-2 opinions and weak structure.
`decision-swarm` provides:
- parallel advisor agents,
- explicit pros/cons and counterarguments,
- confidence/disagreement metrics,
- practical next-step checklists.

## Core outputs

- **Recommended direction** (with confidence band)
- **Dissent map** (why agents disagree)
- **Risk top-3** and mitigation ideas
- **Action checklist** for the next 24 hours / 7 days

## MVP scope (v0)

1. Input schema (`question`, `constraints`, `risk_tolerance`, `time_horizon`)
2. Agent panel execution (N advisors)
3. Aggregation:
   - vote distribution,
   - confidence average/std,
   - argument clustering
4. Markdown/JSON report output

## Repo plan

See `docs/ROADMAP.md`.

## Operations check

```bash
chmod +x scripts/ops-check.sh
./scripts/ops-check.sh
```

Optional:
- `DECISION_SWARM_REPORT_FILE=/tmp/decision-swarm-report.json ./scripts/ops-check.sh`

## Status

- [x] Repository bootstrap
- [ ] MVP execution engine
- [ ] Aggregation + report formatter
- [ ] CLI interface
