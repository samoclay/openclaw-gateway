# Host out of the box (portal token)

Date: 2026-09-11  
Repos: `sam-terraform` (Lambda, Dynamo, sidecar WSS), `openclaw` (Access), `bootstrap-ollama` (Halcyon Host).  
Depends on: multi-host registry (`hostId` / `hostname` on hello), New Sandbox live tags (sidecar still reports `models[]`).  
Status: approved — Cognito register + per-host token + Host starts sidecar; no AWS CLI for customers

## Problem

Halcyon Host writes `~/.aws/config` and asks for `aws sso login` so `run-sidecar.sh` can `ssm:GetParameter` the **shared** staging `SIDECAR_TOKEN`. Customers installing Host on their own hardware will not set up Identity Center. Host currently sets `HALCYON_SKIP_SIDECAR=1` and never starts the sidecar. You want Sign in → token → sidecar running, with no AWS CLI.

The AWS hop is not load-bearing. The sidecar only needs `WS_URL`, a sidecar token, host identity, and a loopback Gateway token in `~/.openclaw/openclaw.json`.

## Non-goals

- IAM users, access keys, or embedding the AWS CLI in the DMG/zip.
- Putting `OPENCLAW_GATEWAY_TOKEN` or the global SSM `SIDECAR_TOKEN` in Lambda HTTP responses or `config.json`.
- Auto-pull of models (New Sandbox still uses live tags on hello).
- Marketing-site copy about tokens or AWS.
- Removing Roles Anywhere for **Halcyon Studio** always-on ops (docs only; not the customer installer path).
- Changing hop-seal, storing prompts/responses, or adding Fargate / RDS / a public Gateway.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Happy path | Existing Host Cognito PKCE → `POST /api/host/register` → keychain → Host starts sidecar |
| Fallback | Access mint / copy-once; Host paste field. Same mint backend |
| Token | Per-host, 256-bit, shown once. Store `tokenHash` only |
| Legacy | WS authorizer still accepts the shared SSM `SIDECAR_TOKEN` (Studio / current ops) |
| Who may mint | Allowlisted Access admin **or** Cognito user with at least one sandbox membership |
| Revoke | Access deletes/rotates hash; that host’s hello fails closed |
| Host AWS SSO | Not required. Keep as optional Studio/ops, not the setup checklist |

## Architecture

```
Host PortalAuth PKCE
        |
POST /api/host/register  { hostId, hostname }  + Cognito JWT
        v
Dynamo host_credentials  { hostId, tokenHash, createdBy, createdAt }
        |
Host keychain  hostSidecarToken + wsUrl
        v
sidecar.mjs  WSS ?kind=sidecar&token=
        |
WS authorizer: shared SSM token OR sha256(token) lookup
        v
crypto hello  hostId hostname models[]   (unchanged New Sandbox)
```

## Who may mint

- Signed-in Cognito user.
- `is_allowlisted_admin(email)` **or** `list_members_by_user(userId)` is non-empty.
- 403 `host_register_forbidden` otherwise (signed-in Workspace user with no sandbox).
- Never trust `tenantId` from the client. `hostId` / `hostname` are the machine’s claimed identity; validate format (`hosts.validate_hostname`, hostId UUID-shaped string already used by Host). Bind the hash to that `hostId`.
- Re-register same `hostId`: rotate (delete old hash row(s) for that host, write new). Return a new plaintext token once.

## Token shape

- Raw: 32 bytes `secrets.token_hex(32)` (64 hex chars). Prefix not required.
- Hash: `sha256(raw)` hex. Table `halcyon_host_credentials` (prefix + `host_credentials`):
  - `hostId` (partition key)
  - `tokenHash`
  - `createdBy` (Cognito `userId`)
  - `createdAt` (unix seconds)
- Authorizer: if `kind=sidecar` and `token == SIDECAR_TOKEN` → allow `principalId=sidecar` (today). Else `get_item(hostId)` is not available from the query string — lookup by hash: **GSI `tokenHash-index`** or store a second item keyed by hash. Prefer **partition key `tokenHash`** plus attribute `hostId` so authorizer is one `GetItem`. Keep `hostId` as a GSI for revoke/rotate-by-host.
  - Locked: **PK `tokenHash`**, GSI `hostId-index` for revoke.
- Do not log the raw token. Do not put it on `GET /api/admin/hosts`.

## HTTP

`POST /api/host/register` (Cognito, not admin-only)

Request: `{ "hostId": "<uuid>", "hostname": "<validated>" }`  
Response 200: `{ "hostSidecarToken": "<hex>", "wsUrl": "wss://ws.staging-portal.halcyonlabs.uk", "hostId": "..." }`  
`wsUrl` from existing portal/WS host env (same host the SPA already uses), not a browser-supplied URL.

`POST /api/admin/hosts/{hostId}/token` — allowlisted admin; same mint/rotate; same one-time body (Access fallback).

`DELETE /api/admin/hosts/{hostId}/token` — allowlisted admin; delete all hash rows for that `hostId`. Live WSS for that token fails on next connect (existing socket may linger until disconnect; v1 acceptable).

## WS authorizer

[`handle_ws_authorizer`](../../../sam-terraform/functions/openclaw_portal/handler.py): after shared-token check, `hash = sha256(token).hexdigest()`, `GetItem` on `host_credentials`. Hit and not missing → `_allow("host:"+hostId, "sidecar", "sidecar", method_arn)`. Miss → existing Cognito-client path (do not treat a user JWT as sidecar).

## Host app

- After successful `PortalAuth.signIn`, call register with stored `hostId` / `hostname`.
- Store `hostSidecarToken` + `wsUrl` in the OS keychain (macOS Keychain / Windows Credential Locker), mode 0600 file only if keychain APIs are unavailable in the current Host target — prefer keychain.
- Start sidecar: **do not** set `HALCYON_SKIP_SIDECAR=1` on this path. New wrapper `scripts/run-sidecar-host.sh` requires `SIDECAR_TOKEN` and `WS_URL` in the environment and **does not** call AWS/SSM. Fail closed if Gateway token missing in `openclaw.json` (existing check).
- Gateway still loopback `:18789`. Host still does not bind Gateway on `0.0.0.0`.
- Setup checklist: drop AWS SSO as a required step. Optional “Configure AWS (Studio)” stays hidden unless profile is Studio.
- Windows Host: same register + start, no `AwsConfig` merge.

## Access

- Live hosts table: add **Revoke** (DELETE token). Does not delete the machine’s identity files.
- Optional **Copy host token** uses admin mint (one-time). Never display the global SSM token.
- Workspace: no host tokens.

## Isolation and telemetry

- Isolation remains sandbox membership for chat. A host token only authenticates the sidecar WSS, not Workspace APIs.
- Prompts/responses still not stored. Telemetry may include `host_id`.
- New Sandbox catalog (`models[]` on hello) unchanged.

## Out of v1

- Short-lived rotating tokens / refresh without re-register.
- Killing an already-open WSS on revoke.
- Embedding AWS CLI.
- Production Host tokens until `deploy_openclaw` / prod sidecar story is explicit (staging first, same as today’s sidecar token).
