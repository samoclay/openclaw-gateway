# Cortana follow-ups (Phases 3–4)

Date: 2026-09-12  
Parent: [2026-09-12-optimiser-system-crew-design.md](../specs/2026-09-12-optimiser-system-crew-design.md)

## Phase 3 — Measured evidence (not started)

**Goal:** After an approved model apply, customers see an Insight that Optimise worked (usage delta), not a Grafana board.

**Stub reserved:**
- Insight `category`: `model_switch_measured` (do not use for unrelated BI rows).
- Telemetry after apply already stamps `model` from the sandbox/role row; extend BI to compare pre/post failure or latency windows when watermarks move.
- SPA `#/insights`: optional one sparkline when `/api/metrics/summary` returns `series`.

**Non-goals:** Prometheus, Grafana, AMP, prompt text in Insights.

## Phase 4 — Host pool / pin recommendations (not started)

**Goal:** Cortana may recommend `capacityMode` / `pinnedHostId` using existing Access capacity rules.

**Stub:**
- Extend `POST /api/sandboxes/{id}/agents/model` body with optional `capacityMode` + `pinnedHostId` (reuse `capacity_fields` + `pick_host`).
- Cortana `capacityHint` in propose JSON becomes actionable only here.

**Non-goals:** Silent failover for pinned sandboxes; spilling to hosts missing the model tag.
