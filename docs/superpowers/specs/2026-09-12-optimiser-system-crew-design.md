# Cortana system crew — model and host switching

Date: 2026-09-12  
Repos: `openclaw` (SPA + contract), `sam-terraform` (Lambda, sidecar), Host Gateway config on inference hosts.  
Depends on: [2026-09-10-workspace-crew-design.md](2026-09-10-workspace-crew-design.md), [2026-09-11-new-sandbox-design.md](2026-09-11-new-sandbox-design.md), [2026-09-11-multi-host-capacity-design.md](2026-09-11-multi-host-capacity-design.md).  
Status: approved for implementation (Phases 1–2); Phases 3–4 follow-up

## Problem

Customers want **evidence of Optimise** and the ability to put the right model (and host capacity) on each agent. Today:

- `modelRef` is sandbox-wide; every role copies it at create.
- Nobody explains what each pulled model is good at, how much RAM it needs, or why to switch.
- Graphs alone do not help; actions do.
- Prompt quality (reasoning vs legal drafting) must stay **private** — never on AWS or public models.

## Non-goals

- Grafana, Prometheus, CloudWatch customer dashboards, or AMP.
- Auto-switch without approval.
- Sending prompts to public/cloud models for “better quality.”
- Client-supplied `model` / `agentId` / `tenantId` / `sessionKey` on chat.
- Deleting Captain or Cortana.
- Enterprise “bring your own AI gateway” as a product.
- Marketing-site stack names (Qwen, Ollama, GPU) on public pages.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Evidence UI | Actionable Insight-style cards (noticed → evidence → recommend → approved → measured). Optional one sparkline later. No Grafana. |
| Quality signal | **Hybrid:** private session context on Host/device for prompt-quality; AWS usage telemetry only for “measured after change.” |
| System agents | Every new sandbox provisions **Captain** (default desk lead) + **Cortana**. Both non-deletable. |
| Approver (v1) | **Captain** (member acting on that approval). No separate CEO agent. |
| Model binding | **Per-agent `modelRef`**. Sandbox `modelRef` remains the default for newly created specialist roles. |
| Host binding | Reuse pool / pin. Cortana may recommend pin or return to pool (Phase 4). |
| Catalog | Live Host union (`tag` + `size`) + curated metadata: great-at, typical RAM band, caveats. |
| Apply path | Server-sealed API after approval; `require_live_model`; re-provision that Gateway agent only. Chat still uses `openclaw/<agentId>`. |
| Cost | Pay-per-use lake/telemetry as today. No new always-on observability stack. |

## Architecture

```text
Private environment                    AWS (usage only)
─────────────────                      ────────────────
Session history ──► Cortana
                      │ propose + why
                      ▼
                 Captain / member approve
                      │
                      ▼
              POST apply (sealed) ──► Lambda ACL
                      │                 │
                      │                 ├── update role.modelRef / capacity
                      │                 └── provision WS → sidecar → Gateway
                      │
                      └── usage events (no prompts) → Firehose → Insights
```

### System crew shape

| Agent | Storage | `systemRole` | Deletable |
|---|---|---|---|
| Captain | Sandbox primary `openclawAgentId`; roster `defaultRole` | `captain` | No |
| Cortana | Entry in `sandbox.roles[]` | `cortana` | No |
| Specialists | `sandbox.roles[]` | absent / empty | Yes |

On create:

1. Provision Captain with sandbox `modelRef` (display name **Captain**).
2. Provision Cortana role with same default `modelRef`, `systemRole: "cortana"`, display name **Cortana**.
3. Roster GET always surfaces both; SPA hides delete for system roles; DELETE (when present) returns 403 for system roles.

### Per-agent model (Phase 2)

- Each role row may carry its own `modelRef`.
- `defaultRole` / Captain uses sandbox `modelRef` until an apply updates the sandbox primary (or a dedicated field); v1: applying to Captain updates sandbox `modelRef` + re-provisions primary agent.
- Chat path unchanged: resolve mention → agent id → Gateway `openclaw/<agentId>`; never trust client `model`.

### Cortana propose (structured)

Cortana emits (in-crew or via control message) a recommendation object. Portal may also accept member-triggered apply from an Insight card. Minimum fields:

```json
{
  "type": "cortana.propose",
  "targetRoleId": "default | roleId",
  "recommendedModelRef": "ollama/qwen3.6:latest",
  "capacityHint": "pool | pin",
  "why": "Long legal drafting threads; stronger drafting model.",
  "estimatedRamBytes": 8000000000,
  "evidence": { "signal": "session_quality", "detail": "drafting" }
}
```

Prompts stay on the Host. AWS stores only the approved apply audit via normal telemetry (`model`, `host_id`, tokens) — not `why` text derived from prompts if that would leak content; prefer short category codes in telemetry.

### Catalog metadata

Static map in `openclaw` (and mirrored helper in Lambda if needed) keyed by tag family / exact tag:

- `greatAt`: short phrases (coding, drafting, fast FAQ, reasoning)
- `ramGuideBytes`: typical loaded size guide (may differ from advertised Ollama `size`)
- `caveats`: optional short string

Merge with live `models[{tag,size}]` for Access and membership-safe Workspace catalog.

## Phased delivery

### Phase 1 — System crew + catalog

- Create provisions Captain + Cortana; non-deletable flags.
- SPA roster + catalog cards (great-at + size band/RAM).
- Specialists still inherit sandbox `modelRef` at create.

### Phase 2 — Per-agent pin + approved apply

- Role-level `modelRef`; sealed apply endpoint; sidecar re-provision.
- Cortana propose + Captain/member approval UX in Workspace.
- Access may still PATCH sandbox / override.

### Phase 3 — Evidence loop (follow-up)

- “Measured” Insights after an apply (usage deltas).
- Optional single sparkline from Dynamo series.
- No Grafana.

### Phase 4 — Host pool/pin recommendations (follow-up)

- Cortana may recommend capacityMode / pinnedHostId changes via existing pick_host rules.

## Security (must not regress)

- Isolation = sandbox membership; `tenantId = sandboxId` from server.
- Never trust client `model` / `agentId` / `tenantId`.
- Prompts/responses not on AWS.
- Hop-seal unchanged.
- No Function URL / `principal = "*"` invoke / public Gateway.
- System agents cannot be removed from roster.

## Success criteria

- New sandbox roster always shows Captain + Cortana; delete fails / UI absent for both.
- Cortana can propose a model switch with a human-readable why without AWS seeing prompts.
- Approved switch changes only that agent’s model on a live Host that has the tag.
- Customer sees measured outcome later (Phase 3), not a raw ops dashboard.

## Testing

- Unit: roster helpers, systemRole delete guard, per-agent modelRef apply + `require_live_model`, catalog merge.
- Contract: authorize-role / chat still ignore client model.
- SPA: system agents locked; catalog renders; apply only after approval affordance.
