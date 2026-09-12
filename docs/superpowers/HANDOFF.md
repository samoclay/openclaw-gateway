# OpenClaw product handoff

Read these for the active track. Do not re-brainstorm.

## Cortana system crew (current)

1. [specs/2026-09-12-optimiser-system-crew-design.md](specs/2026-09-12-optimiser-system-crew-design.md)
2. [plans/2026-09-12-optimiser-system-crew.md](plans/2026-09-12-optimiser-system-crew.md)
3. [specs/2026-09-12-optimiser-followups.md](specs/2026-09-12-optimiser-followups.md) — Phase 3 measured Insights + Phase 4 host pin (deferred)

**Product:** non-deletable Captain + Cortana; per-agent model apply after approval; catalog great-at + RAM. No Grafana. Prompts stay off AWS.

## Workspace crew (prior)

1. [specs/2026-09-10-workspace-crew-design.md](specs/2026-09-10-workspace-crew-design.md)
2. [plans/2026-09-10-workspace-crew.md](plans/2026-09-10-workspace-crew.md)

**Product:** hosted `#/workspace` (roster + Crew room). Access stays `#/admin`. Insights stays usage.

**Repos:** SPA + contract in `openclaw`. Lambda/sidecar in `sam-terraform`. Inference in `bootstrap-ollama`.

**Hop crypto (locked):** X25519 + AES-256-GCM, AAD `sandboxId:threadId`, salt `halcyon-hop-v1`. Lambda never decrypts.

**Do not:** store prompts in Dynamo/S3/Firehose; trust client `agentId`/`model`/`tenantId`; enable Gateway-wide `sessions_send`; add Function URL / public Gateway; Grafana for customer Optimise evidence.

## Future / benched (do not re-brainstorm)

Index (locks + links only): [specs/2026-09-12-future-features-strategy.md](specs/2026-09-12-future-features-strategy.md)

Pickup **one** spec — do not load the others:

- [specs/2026-09-12-airgap-research-egress-design.md](specs/2026-09-12-airgap-research-egress-design.md) — search API over WSS; not Studio/browser/NAT crawl
- [specs/2026-09-12-company-knowledge-design.md](specs/2026-09-12-company-knowledge-design.md) — Host-local retrieval
- [specs/2026-09-12-bi-analyze-design.md](specs/2026-09-12-bi-analyze-design.md) — usage BI only
- [specs/2026-09-12-tool-telemetry-design.md](specs/2026-09-12-tool-telemetry-design.md) — tool event counts, no content

Un-bench only when asked.
