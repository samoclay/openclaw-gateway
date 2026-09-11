# Host Portal Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers and local developers sign into Halcyon Host with Cognito, receive a per-host sidecar token, and Host starts the sidecar — no AWS CLI.

**Architecture:** Lambda mints a 256-bit token, stores only `sha256` on Dynamo `host_credentials` (PK `tokenHash`, GSI `hostId-index`). WS authorizer accepts the legacy shared `SIDECAR_TOKEN` or a hashed host token. Host PKCE calls `POST /api/host/register`, keychains the token, and runs a no-AWS sidecar wrapper.

**Tech Stack:** Python portal handler + Dynamo, Node sidecar unchanged except env, Swift/WinUI Host, static Access SPA.

**Spec:** [docs/superpowers/specs/2026-09-11-host-portal-token-design.md](../specs/2026-09-11-host-portal-token-design.md)

## Global Constraints

- Isolation is sandbox membership; v1 `tenantId = sandboxId`; never trust `tenantId` / `agentId` / `model` / `hostId` from the browser as authority.
- Prompts and responses must not be stored. Telemetry may include `host_id`.
- Hop: X25519 + AES-256-GCM; AAD `sandboxId:threadId`; Lambda never decrypts.
- SPA is a single `site/index.html`. Gold-on-black tokens only.
- Do not put `OPENCLAW_GATEWAY_TOKEN` or the global SSM `SIDECAR_TOKEN` in HTTP responses or `config.json`.
- Gateway binds loopback `:18789` only. Fail closed if Gateway token missing.
- Do not add Fargate, RDS, or a public Gateway.
- Do not add IAM users or access keys. Studio Roles Anywhere stays ops-only.
- Marketing site must not name tokens, AWS, or sidecar internals.

## File map

| File | Responsibility |
|---|---|
| `sam-terraform/functions/openclaw_portal/host_tokens.py` | Hash, mint, put/get/delete credentials |
| `sam-terraform/functions/openclaw_portal/test_host_tokens.py` | Token + authorizer helper tests |
| `sam-terraform/functions/openclaw_portal/db.py` | `host_credentials()` table |
| `sam-terraform/functions/openclaw_portal/handler.py` | Register, admin mint/revoke, WS authorizer lookup |
| `sam-terraform/modules/openclaw/openclaw.tf` | Dynamo table + GSI |
| `openclaw/site/index.html` | Access Revoke + copy-once mint |
| `bootstrap-ollama/scripts/run-sidecar-host.sh` | Sidecar with env token, no AWS |
| `bootstrap-ollama/macos/HalcyonHost/Sources/HostController.swift` | Register, keychain, start sidecar |
| `bootstrap-ollama/windows/HalcyonHost/HostController.cs` | Same |

---

### Task 1: Token helpers (pure)

**Files:**
- Create: `sam-terraform/functions/openclaw_portal/host_tokens.py`
- Create: `sam-terraform/functions/openclaw_portal/test_host_tokens.py`

**Interfaces:**
- Produces: `hash_host_token(raw: str) -> str`, `mint_host_token() -> str`, `can_register_host(email: str, memberships: list, admin_emails: set) -> bool`

- [ ] **Step 1: Write the failing tests**

```python
import hashlib
import unittest
from host_tokens import can_register_host, hash_host_token, mint_host_token


class HostTokenTests(unittest.TestCase):
    def test_hash_is_sha256_hex(self):
        raw = "ab" * 32
        self.assertEqual(hash_host_token(raw), hashlib.sha256(raw.encode()).hexdigest())

    def test_mint_length(self):
        raw = mint_host_token()
        self.assertEqual(len(raw), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in raw))
        self.assertNotEqual(mint_host_token(), raw)

    def test_can_register(self):
        admins = {"ops@halcyonlabs.uk"}
        self.assertTrue(can_register_host("ops@halcyonlabs.uk", [], admins))
        self.assertTrue(can_register_host("a@x.com", [{"sandboxId": "s1"}], admins))
        self.assertFalse(can_register_host("a@x.com", [], admins))
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd sam-terraform/functions/openclaw_portal
python3 -m unittest test_host_tokens.py -v
```

- [ ] **Step 3: Implement**

```python
import hashlib
import secrets


def hash_host_token(raw: str) -> str:
    return hashlib.sha256((raw or "").encode()).hexdigest()


def mint_host_token() -> str:
    return secrets.token_hex(32)


def can_register_host(email: str, memberships: list, admin_emails) -> bool:
    if (email or "").strip().lower() in {e.lower() for e in (admin_emails or set())}:
        return True
    return bool(memberships)
```

- [ ] **Step 4: Tests PASS**
- [ ] **Step 5: Commit** on the feature branch (do not push unless asked)

---

### Task 2: Dynamo + authorizer lookup

**Files:**
- Modify: `sam-terraform/functions/openclaw_portal/db.py`
- Modify: `sam-terraform/modules/openclaw/openclaw.tf` (add table after `openclaw_ws_connections`)
- Modify: `sam-terraform/modules/openclaw/openclaw_site.tf` (`openclaw_dynamodb_tables` output)
- Modify: `sam-terraform/functions/openclaw_portal/host_tokens.py` (put/get/delete)
- Modify: `sam-terraform/functions/openclaw_portal/handler.py` (`handle_ws_authorizer`)
- Modify: `sam-terraform/functions/openclaw_portal/test_host_tokens.py`

**Interfaces:**
- Consumes: `hash_host_token`
- Produces: `put_host_credential(token_hash, host_id, created_by)`, `get_host_credential_by_hash(token_hash) -> dict | None`, `delete_host_credentials(host_id)`
- Authorizer: shared `SIDECAR_TOKEN` still wins; else GetItem by hash

- [ ] **Step 1: Add table** (PAY_PER_REQUEST, same prefix/tags as siblings)

```hcl
resource "aws_dynamodb_table" "openclaw_host_credentials" {
  name         = "${var.table_prefix}host_credentials"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tokenHash"

  attribute {
    name = "tokenHash"
    type = "S"
  }

  attribute {
    name = "hostId"
    type = "S"
  }

  global_secondary_index {
    name            = "hostId-index"
    hash_key        = "hostId"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, local.openclaw_tags)
}
```

Add `host_credentials = aws_dynamodb_table.openclaw_host_credentials.name` to the tables output.

- [ ] **Step 2: db helper**

```python
def host_credentials():
    return _table("host_credentials")
```

- [ ] **Step 3: Tests for lookup (mock table)** — append to `test_host_tokens.py` a `lookup_sidecar_principal(token, shared, get_by_hash) -> str | None` in `host_tokens.py`:

```python
def lookup_sidecar_principal(token: str, shared: str, get_by_hash) -> str | None:
    if token and shared and token == shared:
        return "sidecar"
    if not token:
        return None
    row = get_by_hash(hash_host_token(token))
    if not row or not row.get("hostId"):
        return None
    return "host:" + str(row["hostId"])
```

```python
    def test_lookup_shared_and_host(self):
        shared = "shared-secret"
        self.assertEqual(lookup_sidecar_principal(shared, shared, lambda h: None), "sidecar")
        store = {"deadbeef": {"hostId": "h1"}}
        # use real hash
        raw = "aa" * 32
        digest = hash_host_token(raw)
        self.assertEqual(
            lookup_sidecar_principal(raw, shared, lambda h: {"hostId": "h1"} if h == digest else None),
            "host:h1",
        )
        self.assertIsNone(lookup_sidecar_principal("nope", shared, lambda h: None))
```

- [ ] **Step 4: In `handle_ws_authorizer`**, replace the shared-only sidecar branch with:

```python
    if kind == "sidecar":
        principal = lookup_sidecar_principal(
            token, SIDECAR_TOKEN, get_host_credential_by_hash
        )
        if principal:
            return _allow(principal, "sidecar", "sidecar", method_arn)
        return _deny("anonymous", method_arn)
```

Implement `get_host_credential_by_hash` as `host_credentials().get_item(Key={"tokenHash": token_hash}).get("Item")`. Do not run Cognito verify for `kind=sidecar`.

- [ ] **Step 5: Portal unittest suite PASS** (authorizer tests if they exist; add a thin one if `handle_ws_authorizer` is already tested — do not invent AWS).
- [ ] **Step 6: Commit**

---

### Task 3: Register and revoke HTTP

**Files:**
- Modify: `sam-terraform/functions/openclaw_portal/handler.py`
- Modify: `sam-terraform/functions/openclaw_portal/host_tokens.py` (put/delete using db)
- Modify: `sam-terraform/functions/openclaw_portal/test_handler_model.py` or create `test_handler_host.py`

**Interfaces:**
- Consumes: `mint_host_token`, `hash_host_token`, `can_register_host`, `validate_hostname`
- Produces: `POST /api/host/register`, `POST /api/admin/hosts/{hostId}/token`, `DELETE /api/admin/hosts/{hostId}/token`

- [ ] **Step 1: Persist helpers**

```python
import time
from db import host_credentials


def put_host_credential(token_hash: str, host_id: str, created_by: str) -> None:
    host_credentials().put_item(
        Item={
            "tokenHash": token_hash,
            "hostId": host_id,
            "createdBy": created_by,
            "createdAt": int(time.time()),
        }
    )


def get_host_credential_by_hash(token_hash: str):
    return host_credentials().get_item(Key={"tokenHash": token_hash}).get("Item")


def delete_host_credentials(host_id: str) -> int:
    rows = host_credentials().query(
        IndexName="hostId-index",
        KeyConditionExpression="hostId = :h",
        ExpressionAttributeValues={":h": host_id},
    ).get("Items") or []
    for row in rows:
        host_credentials().delete_item(Key={"tokenHash": row["tokenHash"]})
    return len(rows)
```

- [ ] **Step 2: HTTP tests** (stub Dynamo + session). Assert:
  - register without membership and not admin → 403 `{"error":"host_register_forbidden"}`
  - admin register → 200 keys `hostSidecarToken` (len 64), `wsUrl` from `PUBLIC_WS_URL`, `hostId`
  - response `wsUrl` is not client-supplied
  - DELETE as admin → 200 `{"revoked": true}`
  - body never includes env `SIDECAR_TOKEN`

- [ ] **Step 3: Routes** (Cognito session required, same as other `/api/` routes)

`POST /api/host/register`: if not `can_register_host(user email, list_members_by_user(userId), ADMIN_EMAILS)` raise `ValueError("host_register_forbidden")`. `hostId` = stripped body, must match `^[a-f0-9-]{36}$` (Host UUID). `hostname` via `validate_hostname`. `delete_host_credentials(hostId)` then mint, put, return token + `os.environ.get("PUBLIC_WS_URL") or ""`.

`POST /api/admin/hosts/{hostId}/token` and `DELETE .../token`: allowlisted admin only (same gate as other `/api/admin/hosts`). POST is the same mint/rotate; DELETE calls `delete_host_credentials`.

- [ ] **Step 4: Full portal unittest PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Access revoke + copy-once

**Files:**
- Modify: `openclaw/site/index.html` (`renderAdmin` live hosts table)

**Interfaces:**
- Consumes: `GET /api/admin/hosts`, `POST /api/admin/hosts/{hostId}/token`, `DELETE /api/admin/hosts/{hostId}/token`

- [ ] **Step 1:** On each live host row, add ghost buttons **Revoke** and **New token**.
- [ ] **Step 2:** Revoke → `DELETE` with Bearer; refresh hosts; do not show SSM token.
- [ ] **Step 3:** New token → `POST`; `navigator.clipboard.writeText(body.hostSidecarToken)` or a one-time `<dialog>` showing the hex; never persist in `state`.
- [ ] **Step 4:** Workspace unchanged. `npm test` in openclaw (Node 24).
- [ ] **Step 5: Commit**

---

### Task 5: Host wrapper + macOS start

**Files:**
- Create: `bootstrap-ollama/scripts/run-sidecar-host.sh`
- Modify: `bootstrap-ollama/macos/HalcyonHost/Sources/HostController.swift`
- Modify: `bootstrap-ollama/macos/HalcyonHost/Tests/HalcyonHostTests.swift` if a small URL/path helper is extracted

**Interfaces:**
- Consumes: `POST /api/host/register` with `Authorization: Bearer <id_token>`
- Produces: sidecar process with `SIDECAR_TOKEN` + `WS_URL` + host identity; no AWS

- [ ] **Step 1: Wrapper**

```bash
#!/usr/bin/env bash
# Started by Halcyon Host after portal register. No AWS/SSM.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON="${OPENCLAW_JSON:-$HOME/.openclaw/openclaw.json}"
if [[ -z "${SIDECAR_TOKEN:-}" || -z "${WS_URL:-}" ]]; then
  echo "SIDECAR_TOKEN and WS_URL are required" >&2
  exit 1
fi
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  OPENCLAW_GATEWAY_TOKEN="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["gateway"]["auth"]["token"])' "$JSON")"
  export OPENCLAW_GATEWAY_TOKEN
fi
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" || "$OPENCLAW_GATEWAY_TOKEN" == "REPLACE_WITH_GATEWAY_TOKEN" ]]; then
  echo "Gateway token missing in $JSON" >&2
  exit 1
fi
TF_ROOT="${HALCYON_TF_ROOT:-$(cd "$ROOT/../sam-terraform" 2>/dev/null && pwd || true)}"
SIDECAR_JS="${TF_ROOT:+$TF_ROOT/functions/openclaw_sidecar/sidecar.mjs}"
if [[ -z "${SIDECAR_JS}" || ! -f "$SIDECAR_JS" ]]; then
  echo "Set HALCYON_TF_ROOT to a sam-terraform clone (missing sidecar.mjs)." >&2
  exit 1
fi
exec node "$SIDECAR_JS"
```

- [ ] **Step 2:** After `PortalAuth.signIn` succeeds, `POST` `{hostId, hostname}` to `{portalOrigin}/api/host/register`. On 200, store token + wsUrl in Keychain service `uk.halcyon.host`, accounts `sidecar-token` and `ws-url`.
- [ ] **Step 3:** `extraEnv()` for the Host-started sidecar: set `SIDECAR_TOKEN`, `WS_URL`, `HALCYON_HOST_ID`, `HALCYON_HOSTNAME`. **Do not** set `HALCYON_SKIP_SIDECAR=1` on that launch. Bootstrap/Ollama scripts that must not steal staging keep skip=1.
- [ ] **Step 4:** Start `run-sidecar-host.sh` via the existing ScriptRunner/LaunchAgent pattern used for Gateway (loopback, user domain). Fail closed and log if register is 403 or Gateway token missing.
- [ ] **Step 5:** Setup checklist: remove AWS SSO as a required step; last step is “Portal sign-in + sidecar”. Studio profile may keep a muted Roles Anywhere hint.
- [ ] **Step 6:** Swift tests that still apply; do not add AWS config tests. Commit.

---

### Task 6: Windows Host

**Files:**
- Modify: `bootstrap-ollama/windows/HalcyonHost/HostController.cs`
- Modify: `bootstrap-ollama/windows/HalcyonHost/MainWindow.xaml` (drop required AWS copy if present)

**Interfaces:** Same register URL and env as Task 5.

- [ ] **Step 1:** After portal sign-in, POST register; store token with `PasswordVault` / Credential Locker.
- [ ] **Step 2:** Start `scripts/run-sidecar-host.sh` via WSL or the existing Windows sidecar launch path **only if one already exists**; if Windows today only sets env for a manual script, set `SIDECAR_TOKEN`/`WS_URL` in `extraEnv()` and start the same wrapper through the existing process helper. Do not add AWS profile merge.
- [ ] **Step 3:** Commit.

---

### Task 7: Verify

- [ ] `python3 -m unittest discover -s functions/openclaw_portal -p "test_*.py"`
- [ ] `npm test` in openclaw (Node 24)
- [ ] Host unit tests that exist (Swift/C#)
- [ ] Do not push/apply unless asked. Live: Sign in on Host → register 200 → sidecar WSS without `aws sso login`; Access Revoke → reconnect denied; Studio shared SSM token still works.

---

## Spec coverage

| Spec | Task |
|---|---|
| hash / mint / who may register | T1 |
| Dynamo PK tokenHash + GSI hostId | T2 |
| Authorizer shared or hash | T2 |
| POST register + admin mint/revoke | T3 |
| Access Revoke / copy-once | T4 |
| Host start sidecar, no AWS | T5–T6 |
| No SSM token in HTTP / config.json | T3–T4 |
| Gateway token never in Lambda | all |
| Studio Roles Anywhere remains ops | T5 (checklist only) |
