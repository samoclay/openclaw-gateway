# OpenClaw

Portal + contract repo. AWS lives in `sam-terraform`. Do not add Fargate, RDS, or a public Gateway.

- Isolation is sandbox membership. v1 `tenantId = sandboxId`. Never trust `tenantId` / `agentId` / `model` from the client.
- Local UX: Next.js `/admin`, `/sandboxes`, `/insights`. Hosted: `site/index.html` at `portal.halcyonlabs.uk` / `staging-portal.halcyonlabs.uk` (PKCE + Workspace + Insights + `#/admin` for allowlisted admins). No sandbox → labelled Sample workspace (in-page, not Dynamo). Marketing preview is `staging.halcyonlabs.uk`, not this repo.
- Prompts/responses are not stored on AWS. Workspace history is device-only (encrypted IndexedDB per agent, or memory-only). Telemetry is `@halcyon/telemetry`.
- CI is one npm job (`npm test` + `scripts/package-spa.sh`).
- Inference hosts (Studio/WSL): sibling `bootstrap-ollama`. Gateway template only in this repo (`deploy/openclaw/openclaw.json.template`).

Rules: `.cursor/rules/`. Deep spec (lake/BI only): `.cursor/architecture.md`.
