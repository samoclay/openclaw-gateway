# OpenClaw

Portal + contract repo. AWS lives in `sam-terraform`. Do not add Fargate, RDS, or a public Gateway.

- Isolation is sandbox membership. v1 `tenantId = sandboxId`. Never trust `tenantId` / `agentId` / `model` from the client.
- Local UX: Next.js `/admin`, `/sandboxes`, `/insights`. Hosted customers: `site/index.html` (PKCE + Insights). No sandbox → labelled Sample workspace (in-page, not Dynamo).
- Prompts/responses are not stored. Telemetry is `@halcyon/telemetry`.
- CI is one npm job (`npm test` + `scripts/package-spa.sh`).

Rules: `.cursor/rules/`. Deep spec (lake/BI only): `.cursor/architecture.md`.
