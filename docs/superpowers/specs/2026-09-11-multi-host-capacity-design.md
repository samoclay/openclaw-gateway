# Multi-host Halcyon capacity

Date: 2026-09-11  
Repos: `sam-terraform` (Lambda, sidecar, Dynamo), `openclaw` (hosted SPA + `@halcyon/telemetry`), `bootstrap-ollama` (Halcyon Host + sidecar wrapper).  
Status: approved — registry + Access pool/pin + assign-then-seal

## Problem

[`get_sidecar_connection()`](../../../../sam-terraform/functions/openclaw_portal/db.py) returns the **first** Dynamo `kind=sidecar` row. A second Halcyon-operated Host (laptop + Studio, later a friend’s Windows box) races or steals staging. Hop-seal encrypts the browser turn to **one** X25519 public key; forwarding that box to a different host fails closed (`crypto_setup_failed`).

Customers must never pick machines. Operators must keep one customer’s agents on Studio while other live Hosts take overflow.

## Non-goals

- Workspace (non-admin) picker of host names.
- Paying third-party Hosts or sending tenant A work to an untrusted laptop.
- Halcyon Host starting the sidecar (still a developer installer; sidecar stays a separate process).
- Production marketplace pricing.
- Changing hop algorithms, storing prompts/responses, or adding Fargate / RDS / a public Gateway.
- Silent failover for a **pinned** sandbox.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Approach | **Registry + Access pool/pin + assign-then-seal** (not pool-only, not a work queue). |
| Who picks | Operators on staging Access (`#/admin`). Workspace members see only “N hosts live” / “Capacity offline”. |
| Host identity | `hostId` (UUID, not edited) + `hostname` (developer-typed, unique among live hosts). Not OS product names. |
| Pool | Lambda picks a live host; sticky on the same thread while that host is up. If it drops, the next turn picks another live host. |
| Pin | Sandbox uses that `hostId` only. If it is down, chat is `sidecar_offline`. Operator retargets Access. |
| Seal | Browser seals to the **assigned** host’s `pubKey` for that turn. Do not reuse “first sidecar” `health.pubKey` once more than one host can be live. |
| Telemetry | Stamp `hostId` + tokens/requests. Prompts/responses still forbidden. |
| v1 operators | Halcyon-operated Hosts only. Shared SSM sidecar token stays. |

## Already shipped (UI / identity files)

These exist and must not be redesigned away:

- Hosted SPA chrome: sticky nav, capacity pill, Workspace composer, Access People + Live hosts table, sandbox Capacity `<select>` (currently **disabled** / not persisted).
- Mac + Windows Host: hostname field, copyable `hostId`, grouped actions, persist `~/.openclaw/halcyon-host-id` and `halcyon-hostname` (Windows `%USERPROFILE%\.openclaw\…`). Env `HALCYON_HOST_ID` / `HALCYON_HOSTNAME` on script runs.

**Not shipped:** live registry, sidecar hello fields, persist `capacityMode` / `pinnedHostId`, assign-then-seal, telemetry `hostId`, enable Access select.

## Architecture

```
Halcyon Host (Mac / Windows)
  writes hostId + hostname files
        |
Sidecar process (separate)
  WSS $connect kind=sidecar
  crypto hello: pubKey + hostId + hostname
        v
ws_connections (one row per live WSS)
  connectionId, kind=sidecar, hostId, hostname, pubKey, lastSeen
        |
Lambda pick
  pool: thread.assignedHostId if live, else any live
  pin: sandbox.pinnedHostId only
        v
Browser
  assign → { hostId, pubKey, threadId }
  seal to that pubKey
  WS chat as today
        v
Assigned Host only
  decrypt → Gateway :18789 → sealed deltas
  telemetry { hostId, tokens, requests }
```

## Host identity

| Field | Rules |
|---|---|
| `hostId` | UUID lowercase. Generated once by Host. Stored UserDefaults / `halcyon-host-id`. Not edited. Used for pin, sticky thread, telemetry, later payouts. |
| `hostname` | Developer types it in Host before the sidecar can register. Trimmed. 2–40 chars `[A-Za-z0-9][A-Za-z0-9._-]*`. Unique among **live** sidecars in that env (case-insensitive). Empty or colliding hello is rejected (row not pickable). |

Sidecar reads the same files Host writes (or `HALCYON_HOST_ID` / `HALCYON_HOSTNAME`). Host still does not start the sidecar.

## Registry (Dynamo `ws_connections`)

On sidecar `$connect`, row is `kind=sidecar` (existing). On `{ type: "crypto" }` merge:

- Require `pubKey`, `hostId`, `hostname` (valid).
- Reject if another live sidecar has the same hostname and a different `hostId`.
- Same `hostId` reconnecting updates `connectionId` / `pubKey` / `hostname`.
- `$disconnect` deletes the row (existing). Offline hosts drop off the Access table when the WSS row is gone.

`list_live_sidecars()` returns rows with `kind=sidecar` and a non-empty `pubKey` + `hostId` + `hostname`.

`get_sidecar_connection()` must not remain “first row” for chat or provision.

## Sandbox capacity

On `halcyon_sandboxes`:

- `capacityMode`: `"pool"` (default) or `"pin"`.
- `pinnedHostId`: UUID or empty. Required when mode is `pin`.

Admin PATCH (or create body) sets these. SPA Access select labels:

- `Pool — any connected host`
- `Pin — {hostname} ({hostId})` for each live row

Create-connection defaults to `pool`.

## Assign-then-seal

Hop-seal AAD stays `sandboxId:threadId`. The peer key is the **assigned** host.

1. Client opens WSS (existing JWT).
2. Client sends `{ type: "assign", sandboxId, threadId? }`.
3. Lambda membership-checks, mints/loads thread, **picks** a host, writes `thread.assignedHostId`, replies `{ type: "assign", threadId, hostId, pubKey }`.
4. Client generates hop keys if needed, seals `{ message }` to that `pubKey`, sends existing chat body (`sandboxId`, `threadId`, `clientPubKey`, `sealed`, optional `mentionRoleId`).
5. Lambda forwards the chat job only to that host’s `connectionId`. If the assigned host is gone at forward time: pool → re-assign is **not** allowed on this sealed turn (wrong key); reply `sidecar_offline` or `crypto` and the client must assign again. Pin → `sidecar_offline`.

Picker:

```
if sandbox.capacityMode == "pin":
    host = live_by_id(sandbox.pinnedHostId)
    if not host: fail sidecar_offline
    return host
# pool
if thread.assignedHostId:
    host = live_by_id(thread.assignedHostId)
    if host: return host
return first live host (stable sort by hostname, then hostId)
if none: fail sidecar_offline
```

`GET /api/health` (public, used by the SPA pill and Host):

```json
{ "ok": true, "sidecar": true, "capacity": 2 }
```

- `capacity` = number of live registered hosts.
- `sidecar` = `capacity > 0` (keeps today’s boolean consumers).
- Do **not** put `hosts[]` or a single `pubKey` on this public body once assign exists (Workspace must not list machines; hop key comes from assign).

Admin-only live list (Access): `GET /api/admin/hosts` → `{ hosts: [{ hostname, hostId, status: "online" }] }`. No OS labels.

Provision (create sandbox / add role) posts to the **picked** host for that sandbox (pin → pinned host; pool → any live). If none live, queue behaviour stays `provisionQueued: false` / 503 as today.

## Telemetry

Sidecar `telemetry` events add `hostId` (from the process identity, not the client). Lambda copies it into `data.host_id` via `stamp_and_validate` (allowed; not a prompt field). Enough for Insights balance and later payouts. Forbidden content keys unchanged.

## UX

Unchanged gold-on-black tokens (`#000`, `#f6c453`). Static `site/index.html`. No model / GPU / cloud internals on portal copy.

| Surface | Capacity |
|---|---|
| Workspace / Insights | Pill: `N host(s) live` or `Capacity offline`. Composer disabled when `capacity === 0`. |
| Access | Live hosts table + enabled Capacity select. Persist PATCH. Disabled only when `capacity === 0` (cannot pin a missing host). |
| Host app | Hostname + copyable Halcyon ID; sidecar will not register until hostname is set. |

## Error copy (user-facing)

Reuse `sidecar_offline` (“Capacity is offline…”) when no live host matches pool/pin. Do not name the host to Workspace users. Access may show the pin target as offline in the table (row missing).

## Out of v1

Marketplace, customer host picker, Host-started sidecar, production pricing, multi-region pools.
