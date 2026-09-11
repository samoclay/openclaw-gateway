# New Sandbox (Access)

Date: 2026-09-11  
Repos: `sam-terraform` (Lambda, sidecar), `openclaw` (hosted SPA), `bootstrap-ollama` (Ollama tags on the Host; sidecar still a separate process).  
Depends on: [2026-09-11-multi-host-capacity-design.md](2026-09-11-multi-host-capacity-design.md) (registry, pool/pin, assign-then-seal).  
Status: approved — live pulled tags + silent pool filter + size bands (no invoice rates)

## Problem

Access **New connection** asks for a free-text **Name** and **Model** (`ollama/qwen3.6:latest`). Operators treat that as naming a host or inventing a Gateway string. Live hosts already appear in the Live hosts table. Halcyon Host already knows local Ollama tags; that list never reaches Lambda. A typed `modelRef` can name a tag no live host has pulled. Bigger models should mean a more expensive sandbox (capacity, not seats), but v1 must not invent invoices.

## Non-goals

- Customer invoices, pence-per-token, or a stored currency rate on the sandbox.
- Workspace (non-admin) model picker or host names.
- Auto-pull on a host that lacks the chosen tag.
- Marketing-site model / stack names (Qwen, Ollama, GPU). Access is gated; tags may appear there.
- Halcyon Host starting the sidecar.
- Changing hop-seal, storing prompts/responses, or adding Fargate / RDS / a public Gateway.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Name of the form | **New Sandbox** — creates an isolated environment, not a host. |
| Model source | **Live pulled tags** from sidecar hello `models[]` (Ollama `/api/tags` on that machine). |
| Pool + model | **Union then filter:** Access shows the union of live tags. After a tag is chosen, pool assign/provision only uses hosts that advertise that tag. Capacity control stays Pool / Pin. |
| Pin + model | Model options = that host’s `models[]`. Offline pin stays fail-closed. |
| Persist | Sandbox keeps existing `modelRef` (`ollama/<tag>`). Do not store a rate. |
| Cost v1 | **Band** Compact / Standard / Large from advertised size. Insights already stamp `model` + tokens + `host_id`. |
| Empty catalog | No live tags → disable Create. |
| Workspace | Unchanged: capacity pill only; no model select. |

## Architecture

```
Ollama :11434 /api/tags
        |
Sidecar crypto hello
  pubKey, hostId, hostname, models: [{ tag, size }]
        v
ws_connections row
        |
GET /api/admin/hosts
  hosts[].models (admin only)
        |
Access New Sandbox
  name + model select (union or pin subset) + Capacity
        v
sandbox.modelRef
        |
pick_host / provision
  live hosts filtered to those whose models include modelRef
```

## Model catalog (hello)

Sidecar reads `http://127.0.0.1:11434/api/tags` (2s timeout). Fail open: empty `models` if Ollama is down (host still registers; it simply offers no tags).

Each item: `{ "tag": "qwen3.6:latest", "size": 123456789 }` — Ollama `name` + `size` bytes. Cap 32 items. Drop empty tags. Do not send prompt text.

Lambda `crypto` hello: if `models` is a list, sanitize and merge onto the connection row with `pubKey` / `hostId` / `hostname`. Missing `models` → store `[]` (old sidecars).

`GET /api/admin/hosts` adds `models` per host. Public `/api/health` still `{ ok, sidecar, capacity }` — no tags.

## Matching

`normalize_model_ref(s)`:

- strip; if empty, invalid
- if it already starts with `ollama/`, keep
- else prefix `ollama/`

`host_has_model(row, model_ref)` is true if any advertised `tag` equals the ref with or without the `ollama/` prefix (case-sensitive tag as Ollama returned it).

## Picker (extends multi-host)

Filter `live` to `hosts_for_model(live, sandbox.modelRef)` first (empty `modelRef` → no extra filter, backward compatible). Then existing pin / sticky pool / first-live.

If the filter is empty: `sidecar_offline`. Do **not** spill to a host missing the tag (pool or pin).

Sticky thread: stay on `assignedHostId` only while that host is live **and** still has the tag.

Provision (create sandbox / add role) uses the same filter. None live → `provisionQueued: false` / 503 as today.

Create/PATCH: if `modelRef` is sent and no live host currently has it, reject `400` (`model_unavailable`). Pin + model not on that host → `400`.

## Access UX

Gold-on-black. Static `site/index.html`.

**New Sandbox** (was New connection):

- Copy: creates an isolated environment. Not a host.
- **Name** — environment label (`Acme`). Required.
- **Model** — `<select>` of live tags. Label shows tag without `ollama/` plus band: `qwen3.6:latest — Standard — higher capacity`. Store `ollama/<tag>`.
- **Capacity** — Pool / Pin `{hostname}` as today. Changing pin revalidates the model (if the tag is missing on the new host, clear or block Create).
- Create disabled when the model list is empty or capacity is 0.

Existing sandbox cards: show `modelRef` (strip prefix) + band if the tag is still in the live catalog; otherwise the stored ref only.

Workspace members do not see the catalog.

## Bands

Same Large threshold as Halcyon Host RAM guard: **400 × 1024 × 1024** bytes.

| Band | Size | Access hint |
|---|---|---|
| Compact | `< 200 × 1024 × 1024` | lower capacity |
| Standard | `200 MiB` … `400 MiB` inclusive | — |
| Large | `> 400 × 1024 × 1024` | higher capacity |

Unknown size → Standard. Derive in the SPA (and a shared Python helper for tests) from the live catalog. Do not persist the band.

## Telemetry

Unchanged path: `data.model` from sandbox `modelRef`, `host_id`, tokens. No prompts.

## Error copy

Reuse `sidecar_offline` for Workspace when no host has the sandbox model. Access may say the chosen model is not on any connected host. Do not name hosts to Workspace members.

## Out of v1

Invoices, Workspace picker, auto-pull, marketing-site model names, marketplace pricing.
