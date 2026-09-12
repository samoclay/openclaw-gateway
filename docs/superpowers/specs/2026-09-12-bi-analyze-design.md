# BI analyze (usage only)

Date: 2026-09-12  
Repos: `sam-terraform` (`functions/openclaw_analytics/bi_agent.py`, sidecar stub).  
Depends on: [future-features-strategy](2026-09-12-future-features-strategy.md).  
Status: **benched** beyond today’s stub. Do not implement a Host-side “analyze the chat” path until asked.

## Today

Sidecar treats `bi_analyze` as a **no-op**. Analytics Lambda looks at **usage watermarks** (chats, failures), not prompts.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Input | Usage metrics only (counts, latency, model, `host_id`, tool-call **counts**). |
| Output | Insights cards. No Grafana. |
| Prompts | Never sent to the analytics Lambda. Never stored. |
| Public web | BI does not research the web. |

## Non-goals

- Transcript or session-quality text on AWS.
- Using BI as a back door for research egress.

## Un-bench

If `bi_analyze` becomes a real sidecar job, it may only summarise **already-allowed telemetry fields**. Session-quality for Cortana stays on the Host ([optimiser-system-crew-design](2026-09-12-optimiser-system-crew-design.md)).
