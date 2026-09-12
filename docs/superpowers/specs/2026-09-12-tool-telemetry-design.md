# Tool telemetry

Date: 2026-09-12  
Repos: `openclaw` (`packages/telemetry`), `sam-terraform` (sidecar ingest, lake).  
Depends on: [future-features-strategy](2026-09-12-future-features-strategy.md).  
Related: [airgap-research-egress](2026-09-12-airgap-research-egress-design.md).  
Status: **benched** as a product feature — event **shapes** already reserved. Do not add payloads that leak content.

## Today

`com.halcyon.tool.call` / `com.halcyon.tool.result` exist as event types. Sidecar ingest may count `tool_calls`. No tool executor yet.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Allowed | Count, provider id, status, latency. |
| Forbidden | Query text, URLs if they encode the question, excerpts, page bodies, prompts, responses. Same `stamp.ts` content-key deny list. |
| Lake | `tool_calls` table stays usage, not content. |

## Un-bench

When tools exist, emit the reserved events with counts only. Do not “just add the query for debugging.”
