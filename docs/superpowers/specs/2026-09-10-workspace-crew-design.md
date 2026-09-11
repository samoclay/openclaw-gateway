# Workspace crew desk

Date: 2026-09-10  
Repo: `openclaw` (hosted SPA + contract). AWS changes live in `sam-terraform` (Lambda, sidecar, optional HTTP routes).  
Status: draft for review

## Problem

Staging Access can grant a sandbox and capacity is connected, but a signed-in customer has no hosted UI to talk to the model. Local Next.js `/sandboxes/[id]` is a single-agent SSE chat and is not what CloudFront serves.

Customers need a Grok-style desk: a roster of agents, one shared room, task handoff, history that returns after logout — while Halcyon the company stores **telemetry only** and cannot read prompt text at rest or on the AWS hop.

## Non-goals

- Do not embed or reverse-proxy OpenClaw Control UI (one Gateway process hosts every sandbox on the inference host).
- Do not vendor OpenMausBot, Xiajiao, CopilotKit, or Open WebUI (wrong runtime, bundler, auth, ACL).
- Do not enable Gateway-wide `sessions_send` (cross-customer risk on a shared Studio).
- Do not write prompts, replies, or transcripts to Dynamo, S3, Firehose, or CloudWatch.
- Do not add Fargate, RDS, a public Gateway, or new CloudFront behaviors.
- Do not let the browser choose `tenantId`, `agentId`, `model`, or `sessionKey`.
- v1 is the hosted SPA. Local Next.js parity is follow-up, not this spec.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Surface | `#/workspace` for any user with sandbox membership. Access stays grant/revoke. Insights stays usage. |
| Crew scope | Roles live **inside one sandbox**. They may talk only to siblings in that sandbox. |
| Conversation | One Crew room per sandbox: labelled speakers, `@mention` to hand off, roster on the left. |
| Who adds roles | Any sandbox **member** may add a named role. Model is copied from the sandbox row. |
| UI history | Passkey (WebAuthn PRF) wraps a DEK in this browser’s IndexedDB. Customer never sees the key. New device = empty room. |
| AWS | Telemetry + thread **pointers** only (`threadId`, `sandboxId`, `userId`, `sessionKey`). |
| Live hop | Browser ↔ sidecar X25519 + AES-256-GCM; Lambda forwards sealed boxes and cannot decrypt. Residual risk: a **hostile** Lambda swapping keys. No fingerprint pinning in v1. |
| Inference host | OpenClaw session remains plaintext so the model can continue. That host is the customer environment. |
| Handoff | Portal-mediated: Lambda allowlists sibling agent ids for this sandbox; sidecar runs the next completion. |
| Sample workspace | No Workspace WebSocket, no roles API. Insights sample only. |

OSS shape we copy, not code: OpenMausBot/Grok (agents as contacts) + Xiajiao (`@mention` room).

## Architecture

```
Browser (Workspace)
  PKCE JWT
  passkey-wrapped IndexedDB
  ephemeral X25519
        |  WSS sealed boxes
        v
API Gateway + Lambda
  membership, thread pointers, role allowlist
  never parses sealed payload
        |  PostToConnection
        v
Sidecar (Mac / Studio)
  private X25519 on disk (not SSM)
  decrypt → Gateway :18789 → encrypt deltas
        v
OpenClaw agent (namespaced per sandbox) → Ollama
```

Lambda already relays `{ type: chat }` to the sidecar and `{ type: delta \| done \| error }` to the browser. v1 extends that path; it does not add a second chat transport.

## UX

Hash routes (existing rule): `#/`, `#/insight/:id`, `#/admin`, **`#/workspace`**.

Nav for members: **Workspace** (default after login when they have a sandbox) | Insights | Access (admins only) | Sign out.

Layout (Halcyon gold-on-black, website tokens `--bg: #000`, `--accent: #f6c453`, system sans):

1. **Sandbox switcher** — membership list; one crew at a time.
2. **Roster** — roles in this sandbox. Default role is the agent provisioned at sandbox create (`openclawAgentId`). Idle: static gold sun (splash O). Running: Saturn rings spin (`is-running`); `prefers-reduced-motion` pulses instead. Error: no spin.
3. **Crew room** — chronological bubbles with speaker label (`You`, role display name) and a small sun. Composer supports `@Role`. New thread control mints a new `threadId` (and a new Gateway `sessionKey` pointer).

Hop crypto is **X25519 + AES-256-GCM** (Web Crypto + Node). Spec originally named XChaCha20-Poly1305; that algorithm is not in Web Crypto and the SPA has no bundler.

Capacity chip matches Access: connected / offline. Composer disabled when offline.

### Error copy (user-facing)

Every failure the user can hit must say **what happened**, **where in the chain**, and **what to try**. Do not show stack traces, tokens, raw Gateway bodies, or another tenant’s ids.

Envelope (browser and WS `error` frames):

- `code` — stable machine id
- `stage` — `browser` | `portal` | `sidecar` | `gateway` | `model`
- `title` — short
- `detail` — one or two sentences, chain-aware

| `code` | `stage` | Title | Detail |
|---|---|---|---|
| `not_signed_in` | `portal` | Sign in required | Your session expired. Sign in again to use Workspace. |
| `no_sandbox` | `portal` | No environment yet | You do not have an isolated environment. An admin must grant one in Access. |
| `not_a_member` | `portal` | This environment is closed to you | You are not a member of that sandbox. Choose one from the list or ask an admin. |
| `sidecar_offline` | `sidecar` | Capacity is offline | The portal reached our servers, but the inference host is not connected. Chat stays disabled until capacity shows connected. |
| `crypto_setup_failed` | `browser` | Could not start a private session | This browser could not agree encryption keys with the inference host. Refresh and try again. |
| `decrypt_failed` | `browser` | A reply could not be unlocked | A message arrived from the host but this session could not decrypt it. Nothing was stored. Refresh Workspace. |
| `passkey_unavailable` | `browser` | History will not be saved on this device | Live chat can continue in memory. This browser has no passkey, so Halcyon will not keep a local transcript. |
| `passkey_cancelled` | `browser` | History not unlocked | You cancelled the passkey prompt. The room is empty until you unlock, or you can chat without saving. |
| `role_unknown` | `portal` | That agent is not in this environment | `@mention` only works for roles in the sandbox you have open. |
| `role_create_failed` | `sidecar` | Could not add that agent | The portal saved nothing. Capacity must be connected; try again once it is. |
| `gateway_unreachable` | `sidecar` | The model host did not answer | Capacity is connected, but the local Gateway on the inference host refused or timed out. |
| `model_error` | `model` | The model failed this turn | The environment is up; this completion failed. Try a shorter message or another role. |
| `thread_denied` | `portal` | That conversation does not belong here | The thread id is not yours for this sandbox. Start a new thread. |
| `sealed_rejected` | `portal` | Message not accepted | The portal refused a malformed sealed payload. Nothing was sent to the model. |

Banner placement: capacity/offline in the Workspace header; per-turn errors under the failed bubble; passkey warnings as a non-blocking banner (do not block send).

## Crypto

### Live hop (Lambda cannot read)

- Sidecar generates X25519 **once per host**, private key on disk next to the Gateway token (not SSM, not Dynamo).
- On sidecar `$connect`, sidecar sends `{ type: "crypto", pubKey }` (public). Lambda stores `pubKey` on the sidecar connection row.
- Browser Workspace session: ephemeral X25519. Reads sidecar `pubKey` from `GET /api/health` (or first WS ack). Sends `clientPubKey` on chat frames (public).
- Shared secret: ECDH. Sealed boxes: AES-256-GCM (12-byte IV, 16-byte tag). AAD is `sandboxId:threadId`. HKDF-SHA256 salt `halcyon-hop-v1`.
- Browser → sidecar: ciphertext of `{ message }`.
- Sidecar → browser: ciphertext of `{ delta, fromRoleId }` and a final sealed `{ done: true }`.
- Lambda `is_client_forwardable` includes `sealed` and `error`. Lambda **must not** JSON-parse inside `sealed`.
- Hostile-Lambda MITM (key substitution) is out of v1 scope. Honest-but-curious Lambda (logs, dumps) cannot read plaintext.

### UI history (passkey, this device)

- After a successful decrypt, append the plaintext bubble to an IndexedDB store keyed by `cognitoSub` + `sandboxId` + `threadId`.
- DEK from WebAuthn **PRF** (passkey). Customer never sees hex. Logout does not delete ciphertext.
- New laptop: empty UI. Do not fetch history through Lambda (that would put plaintext on AWS).
- If passkey is missing or cancelled: live chat may run **in memory only**. Never write plaintext transcripts to IndexedDB.

### Inference host

OpenClaw SQLite sessions stay plaintext. Required for the model. Operators with disk on that host are inside the sandbox trust boundary, not “Halcyon SaaS AWS”.

### Shared membership

Two people in the same sandbox share Gateway memory (existing product). They do **not** share IndexedDB. Each browser only shows what it decrypted locally.

## Data model

### Existing (unchanged purpose)

- Sandbox row: `sandboxId`, `tenantId` (= sandboxId in v1), `openclawAgentId`, `modelRef`, `name`.
- `halcyon_threads` / `halcyon_staging_threads`: `threadId`, `sandboxId`, `userId`, `sessionKey` = `portal-<sandboxId>-<threadId>`. No message text.
- Telemetry: `@halcyon/telemetry` stamp; forbidden keys unchanged (`message`, `transcript`, …).

### New: roles

Roles are a list attribute on the sandbox item (`roles`). Each extra role:

- `roleId` — server mint (uuid)
- `displayName` — from the member
- `agentId` — `slugAgentId(sandboxId + roleId)` (same `sbx` + 16 alphanumeric rule as today)
- `modelRef` — copy of sandbox `modelRef` at create; clients cannot set it

The default speaker is `sandbox.openclawAgentId` (`slugAgentId(sandboxId)`), not duplicated in `roles`.

Allowlist for handoff = `{ sandbox.openclawAgentId } ∪ { role.agentId for role in sandbox.roles }`. Membership is equality on that set, never a client-supplied id.

## HTTP and WebSocket

Auth: Cognito ID token `Authorization: Bearer` (existing). Membership from Dynamo, never from the body.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/sandboxes` | member | Existing list + `me`; Workspace uses this first. |
| GET | `/api/health` | public (unchanged) | Existing `{ ok, sidecar }` plus sidecar **public** ECDH key when connected. The key is public; the private key stays on the Mac. |
| GET | `/api/sandboxes/:id/roles` | member | Roster. |
| POST | `/api/sandboxes/:id/roles` | member | `{ name }` only → provision queue. |
| WSS | existing chat URL | member | Sealed turns. |

REST `POST /api/sandboxes/:id/chat` stays **426** on AWS.

### Client WS send

```json
{
  "sandboxId": "<from membership>",
  "threadId": "<optional>",
  "clientPubKey": "<base64>",
  "sealed": "<base64>",
  "mentionRoleId": "<optional, from roster>"
}
```

Lambda ignores `agentId`, `model`, `sessionKey`, `tenantId`. `mentionRoleId` is looked up server-side; unknown or foreign sandbox → `role_unknown`.

Plaintext `message` from the browser is **rejected** (`sealed_rejected`) so a buggy client cannot put prompt text in CloudWatch via Lambda logs of the body. (Lambda may still log envelope keys, never `sealed` plaintext which it cannot decode.)

### Sidecar chat job

Same as today plus `sealed` + `clientPubKey` + resolved `agentId`. Decrypt, `POST /v1/chat/completions` with `openclaw/<agentId>` and `x-openclaw-session-key`. Stream tokens, encrypt each flush, `{ type: sealed, connectionId, threadId, fromRoleId }`. Then `{ type: done }` (unencrypted is acceptable: no content) or a sealed done box.

Handoff: v1 is explicit only (`@` in the composer sets `mentionRoleId`). Sidecar then runs a second completion to that sibling. Each bubble is a separate sealed stream with its own `fromRoleId`. Do not concatenate two speakers into one frame. Automatic yield-without-@ is a follow-up.

### Provision

Existing `{ type: provision, agentId, modelRef, sandboxId }` on sandbox create. Role create reuses it with the new `agentId`. If sidecar is down: HTTP 503 `role_create_failed`, **no** Dynamo role row.

## Isolation

- `tenantId` always from the sandbox row (`resolveTenantId`).
- Chat, roles, mention: `require_member`.
- Thread reuse: existing check (`thread.sandboxId` and `thread.userId`).
- Cross-tenant tests required (user A cannot list B’s roles, cannot mention B’s `roleId`, cannot reuse B’s `threadId`).
- Telemetry `tenant_id` stamped server-side; sidecar telemetry still not forwarded to browsers.

## Testing

- Unit: allowlist mention; reject foreign `mentionRoleId`; ignore spoofed `agentId`/`model`; Lambda helper “open sealed” must not exist — tests assert handler copies `sealed` through and never calls decrypt.
- Telemetry: stamp still throws on `message` / `transcript` keys.
- Sidecar: decrypt-roundtrip fixture; missing private key → `crypto_setup_failed` to client.
- SPA: hash `#/workspace`; composer disabled when `sidecar: false`; error banner uses `title` + `detail`.
- Manual staging: login → Workspace → default role → add role → `@` handoff → refresh with passkey → bubbles return; second Cognito user without membership sees none.

## Rollout

1. Sidecar + Lambda sealed relay (health pubkey) while UI still absent — old plaintext clients fail closed (`sealed_rejected`).
2. SPA Workspace on `site/index.html`; publish via existing `scripts/package-spa.sh`.
3. Staging pin as today. Prod unchanged until an explicit pin.

Keep Gateway `GATEWAY_ONLY` + one staging sidecar on the chosen host.

## Follow-ups (not this spec)

- Local Next.js Workspace parity.
- Sidecar key fingerprint in Access (MITM pin).
- Encrypting the AWS hop with a baked-in sidecar fingerprint at SPA publish.
- Automatic agent-to-agent yield without `@mention`.
- `smollm:135m` quality; prefer the sandbox default model (e.g. Qwen3.6) for crew work.
