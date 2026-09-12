# Company knowledge (local index)

Date: 2026-09-12  
Repos: Host (`bootstrap-ollama` / Gateway sandbox files), not AWS prompt store.  
Depends on: [future-features-strategy](2026-09-12-future-features-strategy.md).  
Related: [airgap-research-egress](2026-09-12-airgap-research-egress-design.md) (live web is the other path).  
Status: **benched** — sketch only. Do not implement until asked.

## Problem

Strict air-gap and `research: off` still need retrieval: policies, handbooks, the customer’s own files. Chat-time must not call the public web.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Chat-time retrieval | **Disk on the Host** (agent sandbox / company knowledge dir). |
| Building the index | Any crawl or dump job runs on a **different** machine that is allowed on the internet, then syncs in. |
| Prompts | Stay on the Host. No corpus text in Dynamo/S3/Firehose. |
| Live web | Out of scope — see research egress. |

## Non-goals

- SearXNG (or similar) on the Studio that still forwards queries to Google/Bing.
- Storing customer documents on AWS as the product default.
- Marketing-site stack names.

## Un-bench

Write a full ingest + path + ACL spec before coding. Isolation remains sandbox membership.
