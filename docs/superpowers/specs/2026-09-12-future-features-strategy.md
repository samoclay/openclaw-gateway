# Future features index

Date: 2026-09-12  
Status: **index only.** Open the **one** spec for the feature you are picking up. Do not re-brainstorm platform locks.

## How to use

1. [HANDOFF.md](../HANDOFF.md) — active track.
2. This file — locks + which spec to open.
3. That spec only.

If a new idea conflicts with **Platform locks**, it is out of scope unless the human overrides this file.

## Platform locks (do not re-argue)

| Topic | Locked |
|---|---|
| Isolation | Sandbox membership. v1 `tenantId = sandboxId` from the **server** row. Never trust client `tenantId` / `agentId` / `model` / `sessionKey`. |
| Prompts | Not stored on AWS (Dynamo, S3, Firehose, CloudWatch, Kendra). `stamp.ts` forbids prompt-shaped keys. |
| Customer answer | Always the **local** Host model. No public/cloud models for quality. |
| Hop | X25519 + AES-256-GCM, AAD `sandboxId:threadId`, salt `halcyon-hop-v1`. Lambda never decrypts chat. |
| History | Encrypted IndexedDB (passkey DEK) or memory-only. New device = empty room. |
| Host network | Gateway `:18789` and Ollama `:11434` loopback. Sidecar outbound WSS 443. No Tailscale funnel / inbound those ports. |
| AWS shape | No Fargate, RDS, public Gateway, Function URL, or `principal = "*"`. OpenClaw Lambda is not in a VPC. |
| Surfaces | `#/workspace`, `#/insights`, `#/admin`. Sample workspace is in-page only. |
| System crew | Non-deletable **Captain** + **Cortana**. |
| Optimise evidence | Insight cards, not Grafana / Prometheus / AMP. |
| Crew comms | Sibling `@mention` allowlist. No Gateway-wide `sessions_send`. |
| Marketing | No stack internals on `halcyon-website`. |

## Specs

Status: **now** · **deferred** · **benched** · **never** (see below).

### Active / already specified

| Feature | Status | Spec |
|---|---|---|
| Captain + Cortana + catalog + apply | now (Phases 1–2) | [optimiser-system-crew-design](2026-09-12-optimiser-system-crew-design.md) |
| Measured Insights after apply | deferred | [optimiser-followups](2026-09-12-optimiser-followups.md) Phase 3 |
| Cortana host pool/pin | deferred | [optimiser-followups](2026-09-12-optimiser-followups.md) Phase 4 |
| Multi-host registry | specified | [multi-host-capacity-design](2026-09-11-multi-host-capacity-design.md) |
| New Sandbox live tags | specified | [new-sandbox-design](2026-09-11-new-sandbox-design.md) |
| Host portal token | specified | [host-portal-token-design](2026-09-11-host-portal-token-design.md) |
| Workspace crew desk | specified | [workspace-crew-design](2026-09-10-workspace-crew-design.md) |

### Benched (one file each)

| Feature | Spec |
|---|---|
| Air-gapped research egress | [airgap-research-egress-design](2026-09-12-airgap-research-egress-design.md) |
| Company knowledge / local index | [company-knowledge-design](2026-09-12-company-knowledge-design.md) |
| BI analyze (usage only) | [bi-analyze-design](2026-09-12-bi-analyze-design.md) |
| Tool telemetry (counts only) | [tool-telemetry-design](2026-09-12-tool-telemetry-design.md) |

## Never

- Grafana / Prometheus / AMP customer Optimise UI.
- Public models for smarter answers.
- Client-supplied `model` / `agentId` / `tenantId` on chat.
- Deleting Captain or Cortana.
- Enterprise “bring your own AI gateway” as a product.
- Reverse-proxy OpenClaw Control UI; vendor OpenMausBot / Open WebUI / CopilotKit.
- Two staging sidecars at once; Halcyon Host starting the sidecar.
- Marketing-site stack names.
