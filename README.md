# decision-swarm

<p align="center">
  <img src="./docs/assets/readme/hero.svg" alt="decision-swarm cover" width="100%" />
</p>

<p align="center">
  <strong>Multi-agent decision support with explicit disagreement modeling.</strong>
</p>

## Overview

decision-swarm is built for decisions where one perspective is not enough.

Given a single question, it orchestrates multiple advisor viewpoints, then produces a compact result package for execution planning.

## Output philosophy

The goal is not “AI says yes/no.”
The goal is:

- recommended direction
- confidence band
- dissent structure
- risk + mitigation list
- immediate action checklist

## Terminal snapshot

![decision-swarm terminal](./docs/assets/screenshots/terminal.svg)

## MVP scope

1. Structured input schema
2. Parallel advisor execution
3. Aggregation and consensus scoring
4. Markdown + JSON report generation

## Operations check

```bash
chmod +x scripts/ops-check.sh
./scripts/ops-check.sh
```

Optional:

```bash
DECISION_SWARM_REPORT_FILE=/tmp/decision-swarm-report.json ./scripts/ops-check.sh
DECISION_SWARM_HISTORY_FILE=/tmp/decision-swarm-history.jsonl ./scripts/ops-check.sh
```

## Status

- [x] bootstrap + base docs
- [ ] execution engine
- [ ] aggregation internals
- [ ] CLI flow

## License

MIT (or project-defined license)
