# decision-swarm roadmap

## Phase 0 — Bootstrap (Done)
- Repo initialized
- Core concept and MVP scope documented

## Phase 1 — Data contracts
- Define `DecisionInput` and `AgentOpinion` JSON schema
- Define `AggregateResult` schema
- Add schema validation utilities

## Phase 2 — Execution core
- Implement advisor runner interface
- Add local mock advisors for deterministic tests
- Add timeout/retry handling

## Phase 3 — Aggregation
- Implement voting and confidence summary
- Add dissent clustering (argument themes)
- Add risk extraction and ranking

## Phase 4 — Report + CLI
- Generate markdown + JSON report
- CLI command: `decision-swarm run --input ./case.json`
- Exit codes for automation

## Phase 5 — Ops + QA
- Unit tests for schema and aggregation
- Smoke tests with sample cases
- CI lint/test workflow
