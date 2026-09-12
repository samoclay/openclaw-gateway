# Air-gapped research egress

Date: 2026-09-12  
Repos: `openclaw` (SPA + contract), `sam-terraform` (Lambda, sidecar), Host in `bootstrap-ollama`.  
Depends on: [future-features-strategy](2026-09-12-future-features-strategy.md) (platform locks), hop-seal in [workspace-crew-design](2026-09-10-workspace-crew-design.md).  
Related: [company-knowledge](2026-09-12-company-knowledge-design.md) (strict air-gap fallback).  
Status: **benched** — do not implement until asked. Do not re-brainstorm egress.

## Problem

Agents will need live web research. DIY fetch from the Studio smashes the **home router** and burns a **residential IP**. Browser fetch does the same to the user. AWS NAT/Fargate page-get is expensive and still scraping. A customer host firewalled to AWS-only cannot crawl at all.

Today the sidecar is one-shot chat (`max_tokens: 96`), no tools. There is no search/browse/fetch tool.

## Hard fact

Any live search API receives a **short query**. That query is customer-derived and **does** cross the internet. You cannot have live web + “no customer data leaves the box.” Strict no-egress = [company knowledge](2026-09-12-company-knowledge-design.md) only.

## Non-goals

- Crawl from Studio, Workspace tab, or AWS NAT/Fargate/Lambda GET page.
- Sending prompts to public models so the **answer** is smarter (Cortana lock).
- Enabling OpenClaw Gateway generic web tools on the Host.
- A public Halcyon research API.
- Serper / SerpAPI (Google SERP via a scraper).
- Cortana model/host switching (that stays private-on-host).

## Decisions (locked when un-benched)

| Topic | Choice |
|---|---|
| Live path | **Search API via existing WSS.** Host rewrites turn → short query. Lambda (no VPC) calls vendor. Returns titles + URLs + excerpts. Local model synthesises. |
| Air-gap Host | Studio may allowlist **AWS only**. Research still works (query rides the sidecar hop). |
| Strict isolation | Sandbox `research: off`. Local / company knowledge only. Say so in the reply. |
| Customer-facing voice | Local model only. Vendor output is **source snippets**, never the desk voice. |
| Query hygiene | Host rewrite; reject transcript-sized payloads. Do **not** log query or excerpts (Dynamo, S3, Firehose, CloudWatch). Telemetry = `com.halcyon.tool.call` count + provider + status. |
| Rate | Default **one search per user turn**; hard cap (e.g. 3) if the member asks to go deeper. |
| Flag | Sandbox `research: off \| on` (v1). |
| Secrets | Vendor key in **SSM**. Not on the Studio, not in git. |
| Prerequisite | Sidecar/Gateway **tool-call loop** + `research.query` / `research.result`. Fail-closed: `research_disabled`, `research_quota`, `research_unavailable`. |

```text
Host (rewrite query)
  → WSS research.query
  → Lambda (in memory only; no logs)
  → vendor search API
  → excerpts JSON
  → WSS research.result
  → local model synthesises
```

## Providers

Same hop; `provider: brave | staan | tavily | openai`.

| Provider | When un-benched | Why |
|---|---|---|
| **Brave Search** | Default candidate | ~$5/1k, high QPS, own index. Public plan keeps query logs ~90 days. **ZDR = enterprise** only. |
| **Staan** | Spike | ~€1/1k, EU routing, p95 claimed &lt; 800 ms. Check UK SMB quality before locking. |
| **Tavily** | Optional | ~$8/1k, better excerpts, not cheaper. |
| **OpenAI `web_search`** | Optional, **default off** | ~$10/1k + tokens. Official search (we are not the crawler) but it is an answer engine. If used: snippets in, local synth out, ZDR/data-controls. |
| **Serper / SerpAPI** | Never | Query hits a scraper and Google. |

## Un-bench checklist

1. Do not re-open crawl-from-home vs browser vs NAT.
2. Provider interface + Brave (or spike winner) + SSM key + per-tenant cap.
3. Sidecar tool loop; Lambda still must not decrypt **chat**. Research query is a new control message — must not hit CloudWatch.
4. Workspace: citation chips; optional explicit “research this.”
5. OpenAI provider only after 1–4 if still wanted.

## Testing (when built)

- Unit: rewrite rejects long payloads; rate cap; provider interface fail-closed.
- Contract: telemetry has no query/excerpt keys.
- Manual: host firewalled to AWS-only can still research; `research: off` never calls vendor.
