# Workspace crew Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hosted Workspace so a sandbox member can talk to a crew (default agent plus named roles), with sealed hops, passkey-local history, and gold-on-black Halcyon chrome including a spinning sun while agents run.

**Architecture:** Browser seals turns to the sidecar’s X25519 public key. Lambda checks membership, mints thread pointers, allowlists sibling agent ids, and forwards opaque boxes. Sidecar decrypts, calls loopback Gateway, encrypts deltas. UI history never enters AWS.

**Tech Stack:** `site/index.html` (no bundler), Cognito PKCE, API Gateway HTTP + WebSocket, Python Lambda, Node sidecar, OpenClaw Gateway, Ollama.

**Spec:** `docs/superpowers/specs/2026-09-10-workspace-crew-design.md`

## Global Constraints

- Isolation is sandbox membership; v1 `tenantId = sandboxId`; never trust `tenantId` / `agentId` / `model` / `sessionKey` from the client.
- Prompts and responses must not be stored in Dynamo, S3, Firehose, or CloudWatch.
- Hop: X25519 + AES-256-GCM; AAD `sandboxId:threadId`; salt `halcyon-hop-v1`; Lambda never decrypts.
- SPA is a single `site/index.html` (CloudFront pins that object only).
- Gold-on-black website tokens; spinning sun on running agents; `prefers-reduced-motion` pulses.
- No Fargate, RDS, public Gateway, or new CloudFront behaviors.
- REST `POST /api/sandboxes/:id/chat` stays 426 on AWS.
- WS connect `token` is Cognito access token; HTTP `Authorization` is id token.
- One npm CI job in openclaw; Lambda zip via `functions/openclaw_portal/package.sh`.

---

### Task 1: Contract packages (errors, roles, telemetry, hop-seal)

**Files:** `packages/core/src/workspace-errors.ts`, `authorize-role.ts`, tests; `packages/telemetry/src/stamp.ts`; `packages/hop-seal/**`

**Produces:** `WORKSPACE_ERRORS`, `resolveMentionAgent`, `slugRoleAgentId`, `sealBox` / `openBox`, `sealed` forwardable.

### Task 2: Lambda + sidecar

**Files:** `sam-terraform/functions/openclaw_portal/{acl,handler,db,telemetry,workspace_errors,package}.py/sh`; `functions/openclaw_sidecar/{sidecar,hop-seal}.mjs`

**Produces:** `/api/sandboxes/:id/roles`, health `pubKey`, sealed WS, provision extra agents, structured errors.

### Task 3: Hosted SPA

**Files:** `openclaw/site/index.html`, `apps/portal/src/app/globals.css`

**Produces:** `#/workspace` crew desk, gold theme, sun, sealed WS client, passkey IndexedDB.

### Task 4: Verify

`npm test` in openclaw; `python3 -m unittest discover -s functions/openclaw_portal -p "test_*.py"` in sam-terraform; staging health `sidecar: true`; browser Workspace chat + spinning sun.
