# Multi-host capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Many Halcyon-operated Hosts can register; operators pool or pin each sandbox; the browser seals each turn to the assigned host’s hop key.

**Architecture:** Each sidecar `$connect` is a live registry row (`hostId`, `hostname`, `pubKey`). Lambda picks a host (sticky pool or fail-closed pin), returns that `pubKey` on WS `assign`, then forwards the sealed chat only to that `connectionId`. Telemetry stamps `hostId`. Workspace never lists hostnames.

**Tech Stack:** Dynamo `ws_connections` + `sandboxes` + `threads`, Python Lambda, Node sidecar, static `site/index.html`, Halcyon Host identity files.

**Spec:** [docs/superpowers/specs/2026-09-11-multi-host-capacity-design.md](../specs/2026-09-11-multi-host-capacity-design.md)

## Global Constraints

- Isolation is sandbox membership; v1 `tenantId = sandboxId`; never trust `tenantId` / `agentId` / `model` / `hostId` from the browser.
- Prompts and responses must not be stored. Telemetry may include `host_id`, tokens, request counts.
- Hop: X25519 + AES-256-GCM; AAD `sandboxId:threadId`; Lambda never decrypts.
- SPA is a single `site/index.html`. Gold-on-black tokens only.
- Host app does not start the sidecar. Shared SSM sidecar token stays Halcyon-only.
- Pinned sandbox: no silent failover.
- Do not add Fargate, RDS, or a public Gateway.

## File map

| File | Responsibility |
|---|---|
| `sam-terraform/functions/openclaw_portal/hosts.py` | Hostname validation, list live, pick pool/pin |
| `sam-terraform/functions/openclaw_portal/db.py` | `list_sidecar_connections()` |
| `sam-terraform/functions/openclaw_portal/handler.py` | crypto hello, health, admin hosts, assign, chat forward, provision target |
| `sam-terraform/functions/openclaw_portal/test_hosts.py` | Picker + hostname tests |
| `sam-terraform/functions/openclaw_sidecar/sidecar.mjs` | Send `hostId` + `hostname` on crypto; stamp telemetry |
| `bootstrap-ollama/scripts/run-sidecar.sh` | Export identity files into env |
| `openclaw/site/index.html` | Assign before seal; persist Capacity; `/api/admin/hosts` |
| `openclaw/packages/telemetry` | Allow `host_id` in `data` (already allowed if not forbidden) |

---

### Task 1: Host picker (pure functions)

**Files:**
- Create: `sam-terraform/functions/openclaw_portal/hosts.py`
- Create: `sam-terraform/functions/openclaw_portal/test_hosts.py`

**Interfaces:**
- Produces: `validate_hostname(name) -> str`, `list_live(rows) -> list`, `pick_host(sandbox, thread, live) -> dict | None`

- [ ] **Step 1: Write the failing tests**

```python
import unittest
from hosts import validate_hostname, pick_host, hostname_collision, list_live


class HostPickerTests(unittest.TestCase):
    def test_hostname_rules(self):
        self.assertEqual(validate_hostname("  Studio-1  "), "Studio-1")
        with self.assertRaises(ValueError):
            validate_hostname("")
        with self.assertRaises(ValueError):
            validate_hostname("x")
        with self.assertRaises(ValueError):
            validate_hostname("no spaces")

    def test_collision_other_host(self):
        live = [{"hostId": "aaa", "hostname": "desk", "pubKey": "k"}]
        self.assertTrue(hostname_collision("desk", "bbb", live))
        self.assertFalse(hostname_collision("desk", "aaa", live))

    def test_pin_missing_is_none(self):
        sandbox = {"capacityMode": "pin", "pinnedHostId": "gone"}
        self.assertIsNone(pick_host(sandbox, {}, [{"hostId": "live", "hostname": "a", "pubKey": "k"}]))

    def test_pin_hits(self):
        live = [{"hostId": "h1", "hostname": "studio", "pubKey": "pk"}]
        hit = pick_host({"capacityMode": "pin", "pinnedHostId": "h1"}, {}, live)
        self.assertEqual(hit["hostId"], "h1")

    def test_pool_sticky_then_failover(self):
        a = {"hostId": "a", "hostname": "alpha", "pubKey": "1"}
        b = {"hostId": "b", "hostname": "beta", "pubKey": "2"}
        self.assertEqual(pick_host({"capacityMode": "pool"}, {"assignedHostId": "b"}, [a, b])["hostId"], "b")
        self.assertEqual(pick_host({"capacityMode": "pool"}, {"assignedHostId": "b"}, [a])["hostId"], "a")

    def test_list_live_requires_identity(self):
        rows = [
            {"kind": "sidecar", "pubKey": "k", "hostId": "h", "hostname": "desk"},
            {"kind": "sidecar", "pubKey": "k"},
            {"kind": "client"},
        ]
        self.assertEqual([r["hostId"] for r in list_live(rows)], ["h"])
```

- [ ] **Step 2: Run to verify fail**

```bash
cd sam-terraform/functions/openclaw_portal
python3 -m unittest test_hosts.py -v
```

Expected: `ModuleNotFoundError` or import fail.

- [ ] **Step 3: Implement `hosts.py`**

```python
import re

HOSTNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$")


def validate_hostname(name: str) -> str:
    trimmed = (name or "").strip()
    if not HOSTNAME_RE.match(trimmed):
        raise ValueError("hostname is required")
    return trimmed


def list_live(rows: list) -> list:
    out = []
    for row in rows or []:
        if row.get("kind") != "sidecar":
            continue
        if not (row.get("pubKey") and row.get("hostId") and row.get("hostname")):
            continue
        out.append(row)
    return sorted(out, key=lambda r: (str(r.get("hostname") or "").lower(), r.get("hostId") or ""))


def hostname_collision(hostname: str, host_id: str, live: list) -> bool:
    want = hostname.lower()
    for row in live:
        if str(row.get("hostname") or "").lower() == want and row.get("hostId") != host_id:
            return True
    return False


def pick_host(sandbox: dict, thread: dict, live: list) -> dict | None:
    live = list_live(live) if live and live[0].get("kind") else list(live or [])
    by_id = {row.get("hostId"): row for row in live}
    if (sandbox or {}).get("capacityMode") == "pin":
        return by_id.get((sandbox or {}).get("pinnedHostId"))
    assigned = (thread or {}).get("assignedHostId")
    if assigned and assigned in by_id:
        return by_id[assigned]
    return live[0] if live else None
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
python3 -m unittest test_hosts.py -v
```

- [ ] **Step 5: Commit** when the user asks (do not push production pins).

---

### Task 2: Registry + health + admin hosts

**Files:**
- Modify: `sam-terraform/functions/openclaw_portal/db.py` (`get_sidecar_connection` callers switch to list)
- Modify: `sam-terraform/functions/openclaw_portal/handler.py` (crypto merge, health, `GET /api/admin/hosts`)
- Test: `test_hosts.py` plus a thin handler test if fixtures exist; otherwise keep picker tests + health shape test.

**Interfaces:**
- Consumes: `validate_hostname`, `hostname_collision`, `list_live`
- Produces: `list_sidecar_connections()`, health `{ ok, sidecar, capacity }`, admin `{ hosts: [{ hostname, hostId, status }] }`

- [ ] **Step 1: `list_sidecar_connections` in `db.py`**

```python
def list_sidecar_connections() -> list[dict]:
    result = connections().query(
        IndexName="kind-index",
        KeyConditionExpression=Key("kind").eq("sidecar"),
    )
    return result.get("Items") or []


def get_sidecar_connection() -> dict | None:
    live = [r for r in list_sidecar_connections() if r.get("pubKey") and r.get("hostId") and r.get("hostname")]
    return live[0] if live else None
```

Keep `get_sidecar_connection` as “any live registered host” only as a temporary helper; chat/provision must use `pick_host`.

- [ ] **Step 2: Crypto hello** in `handle_sidecar_message` for `type == "crypto"`:

Require `pubKey`, `hostId`, `hostname`. `validate_hostname`. If `hostname_collision` against other live rows, return 409 and do not merge hostname. Merge `{ kind, pubKey, hostId, hostname }`.

- [ ] **Step 3: Health**

```python
live = list_live(list_sidecar_connections())
return _http(200, {"ok": True, "sidecar": bool(live), "capacity": len(live)})
```

Do not include `pubKey` or `hosts` on `/api/health`.

- [ ] **Step 4: `GET /api/admin/hosts`**

`require_admin`. Body: `{ "hosts": [{ "hostname", "hostId", "status": "online" }] }` from `list_live`.

- [ ] **Step 5: Run**

```bash
cd sam-terraform/functions/openclaw_portal
python3 -m unittest discover -s . -p "test_*.py"
```

Expected: existing tests still pass; add `test_health_capacity_shape` if you can call the health branch with a stub.

---

### Task 3: Sandbox pin fields + PATCH

**Files:**
- Modify: `handler.py` `create_sandbox` and `POST /api/admin/sandboxes`
- Add: `PATCH /api/admin/sandboxes/{id}` for `capacityMode` / `pinnedHostId`

**Interfaces:**
- Produces: sandbox rows with `capacityMode` default `"pool"`, optional `pinnedHostId`

- [ ] **Step 1: Helper**

```python
def capacity_fields(body: dict) -> dict:
    mode = str(body.get("capacityMode") or body.get("capacity") or "pool").strip()
    if mode not in ("pool", "pin") and mode != "pool":
        if mode and mode != "pool":
            mode = "pin"
            pinned = str(body.get("pinnedHostId") or body.get("capacity") or "").strip()
        else:
            mode = "pool"
            pinned = ""
    else:
        pinned = str(body.get("pinnedHostId") or "").strip()
    if mode == "pin" and not pinned:
        raise ValueError("pinnedHostId is required when capacityMode is pin")
    if mode == "pool":
        pinned = ""
    return {"capacityMode": mode, "pinnedHostId": pinned}
```

SPA create form today sends `capacity` as `"pool"` or a hostId. Accept both: `capacity === "pool"` → pool; otherwise pin to that id.

- [ ] **Step 2: `create_sandbox(..., capacity=None)`** writes the two fields. PATCH updates only those keys on an existing sandbox.

- [ ] **Step 3: Tests** for pin-without-id raises; pool clears `pinnedHostId`.

---

### Task 4: Assign-then-seal + sticky thread

**Files:**
- Modify: `handler.py` `handle_client_chat_ws`, `_prepare_chat`
- Modify: `site/index.html` `ensureHop` / `sendTurn`

**Interfaces:**
- Produces: WS `{ type: "assign", sandboxId, threadId? }` → `{ type: "assign", threadId, hostId, pubKey }`
- Chat forward uses `thread.assignedHostId`’s `connectionId` only

- [ ] **Step 1: Assign handler** (membership via `_prepare_chat` minus sealed body, or a slimmer `_prepare_thread`):

```python
def handle_assign(authorizer, connection_id, body):
    user_id = authorizer["userId"]
    sandbox_id = body["sandboxId"]
    sandbox = get_sandbox(sandbox_id)
    require_member(...)
    # mint/load thread like _prepare_chat without sealed
    live = list_live(list_sidecar_connections())
    thread = get_thread(thread_id) or {}
    host = pick_host(sandbox, thread, live)
    if not host:
        _post_ws(connection_id, workspace_error("sidecar_offline"))
        return {"statusCode": 503}
    put_thread({**thread, "threadId": thread_id, "sandboxId": sandbox_id, "userId": user_id, "sessionKey": ..., "assignedHostId": host["hostId"]})
    _post_ws(connection_id, {"type": "assign", "threadId": thread_id, "hostId": host["hostId"], "pubKey": host["pubKey"]})
    return {"statusCode": 200}
```

Route: if client body `type == "assign"`, call this. Otherwise existing chat (require sealed).

- [ ] **Step 2: Chat forward**

```python
host = pick_host(sandbox, get_thread(turn["threadId"]), list_live(...))
if not host or host["hostId"] != get_thread(...)["assignedHostId"]:
    # sealed for a missing host
    _post_ws(..., workspace_error("sidecar_offline"))
_post_ws(host["connectionId"], job)
```

If the assigned host disappeared after assign, do **not** pick another host for this sealed box.

- [ ] **Step 3: SPA**

In `sendTurn`, after WS open:

```javascript
ws.send(JSON.stringify({ type: "assign", sandboxId: current.sandboxId, threadId: state.threadId || undefined }));
const assigned = await waitForAssign(ws); // { threadId, hostId, pubKey }
state.threadId = assigned.threadId;
state.hop = { pair: await hopGenerate(), peer: fromB64url(assigned.pubKey), hostId: assigned.hostId };
```

Clear `state.hop` when `threadId` changes or assign returns a different `hostId`. Stop using `health.pubKey`.

`capacityCount(health)` already prefers `health.capacity` then `health.hosts.length` then `sidecar`.

- [ ] **Step 4: Access persist**

`GET /api/admin/hosts` for the table (fallback `health.hosts` empty). Enable Capacity `<select>`. On change and on create, `PATCH` / POST `capacityMode` + `pinnedHostId`.

- [ ] **Step 5: Browser-verify** Workspace assign + Access select on staging after Lambda + SPA pins.

---

### Task 5: Sidecar hello + Host files + telemetry

**Files:**
- Modify: `sam-terraform/functions/openclaw_sidecar/sidecar.mjs`
- Modify: `bootstrap-ollama/scripts/run-sidecar.sh`
- Modify: `handler.py` `_ingest_sidecar_telemetry`

**Interfaces:**
- Consumes: `HALCYON_HOST_ID`, `HALCYON_HOSTNAME`, or `~/.openclaw/halcyon-host-id` / `halcyon-hostname`
- Produces: crypto `{ type, pubKey, hostId, hostname }`; telemetry includes `hostId`

- [ ] **Step 1: Read identity in sidecar.mjs** (trim files; fail closed if hostname empty — log and do not send crypto until set).

- [ ] **Step 2: `run-sidecar.sh`** export from files like `HALCYON_HOST_MODEL`.

- [ ] **Step 3: `emitTelemetry`** add `hostId`. Lambda `data={"host_id": body.get("hostId"), ...}`.

- [ ] **Step 4: Provision** `_post_ws(pick_host(...)["connectionId"], provision)` — pin to pinned host, else any live.

---

### Task 6: Verify

- [ ] `python3 -m unittest discover -s functions/openclaw_portal -p "test_*.py"` in `sam-terraform`
- [ ] `npm test` in `openclaw`
- [ ] Two sidecars on staging: Access shows two hostname + hostId rows; pin a sandbox to Host A; stop A → Workspace `sidecar_offline`; pool sandbox fails over on the **next** assign after A disconnects
- [ ] Hop-seal: laptop and Studio have different `pubKey`; sealing to A and forwarding to B must not succeed
- [ ] Insights events include `host_id` and never prompts

Publish: openclaw `staging` → SPA pin PR; sam-terraform Lambda zip + `openclaw_lambda_version` as today’s OpenClaw publish path. Host app is a local rebuild, not CloudFront.
