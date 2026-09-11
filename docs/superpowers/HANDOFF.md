# Workspace crew — next-session handoff

Read these, in order. Do not re-brainstorm.

1. [specs/2026-09-10-workspace-crew-design.md](specs/2026-09-10-workspace-crew-design.md)
2. [plans/2026-09-10-workspace-crew.md](plans/2026-09-10-workspace-crew.md)

**Product:** hosted `#/workspace` (Grok-style roster + one Crew room). Access stays `#/admin`. Insights stays usage.

**Repos:** SPA + contract in `openclaw`. Lambda/sidecar in `sam-terraform`. Inference in `bootstrap-ollama`.

**Hop crypto (locked):** X25519 + AES-256-GCM, AAD `sandboxId:threadId`, salt `halcyon-hop-v1`. Lambda never decrypts. Spec named XChaCha20; Web Crypto does not have it.

**Theme:** gold-on-black tokens from `halcyon-website/assets/css/styles.css`. Spinning sun = splash gold O + Saturn rings. `prefers-reduced-motion`: pulse only.

**History:** v1 stores the room in this browser’s IndexedDB (not Dynamo). Passkey PRF wrapping is a follow-up; AWS still never receives prompt text.

**Do not:** store prompts in Dynamo/S3/Firehose; trust client `agentId`/`model`/`tenantId`; enable Gateway-wide `sessions_send`; vendor Control UI / OpenMausBot; add CloudFront behaviors; split the SPA into extra S3 objects.

**WS client auth:** query `token` = Cognito **access** token (`get_user`). HTTP uses **id** token.

**Staging sidecar:** `AWS_PROFILE=sam-personal OPENCLAW_ENV=staging ./scripts/run-sidecar.sh` from `bootstrap-ollama` (this laptop stole staging). One sidecar only. Gateway: `GATEWAY_ONLY=1 ./scripts/up.sh`.
