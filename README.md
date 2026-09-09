# Halcyon OpenClaw portal

Browser console for **admin-assigned sandboxes**. Clients log in, chat with an isolated OpenClaw agent, and never see the Gateway token or another client’s memory.

Inference stays on your **Mac Studio** (Ollama + OpenClaw). This repo is the client experience: login, ACL, streaming chat.

Isolation: one OpenClaw agent per sandbox. Client A cannot read Client B unless an admin explicitly grants the same sandbox (shared memory on purpose).

## Local run

Requires **Node 24** and **npm 11+** (`engines` are strict).

1. Start DynamoDB Local:

```bash
docker compose up -d
```

2. Copy env and set the Gateway token from `~/.openclaw/openclaw.json`:

```bash
cp .env.example .env
```

3. Install and boot the portal (creates tables + bootstrap admin):

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default admin is `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

Point `OPENCLAW_GATEWAY_URL` at the Studio Gateway (`http://127.0.0.1:18789`). Ollama `baseUrl` must **not** use `/v1`.

Apply [`deploy/openclaw/openclaw.json.template`](deploy/openclaw/openclaw.json.template) on the Gateway host (Chat Completions on, Docker sandbox `mode: all` / `scope: agent`). Creating a sandbox in the admin UI runs [`scripts/provision-sandbox.mjs`](scripts/provision-sandbox.mjs).

```bash
npm test
```

Local auth is an HttpOnly cookie (`halcyon_session`). Do not expose this Next.js process to the public internet; AWS uses Cognito + Lambda instead.

## CI

GitHub Actions on `master` / `main` / `staging` and pull requests:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — Node 24, **npm@latest** CLI, **`npm ci`**, `npm audit --audit-level=high`, tests, portal build. `contents: read` only. SHA-pinned actions.
- [`.github/workflows/publish.yml`](.github/workflows/publish.yml) — branch **staging** uses GitHub Environment `staging`; **master**/**main** use `production`. Packages [`site/index.html`](site/index.html) (hosted CloudFront SPA, not the Next.js BFF). S3 upload uses that environment’s `AWS_ROLE_ARN` and `ARTIFACTS_BUCKET` only — staging cannot publish to the prod bucket.

Pin that SHA in sam-terraform `envs/staging/staging.tfvars` or `envs/production/production.tfvars` and apply **that** env dir. Login host comes from terraform-managed `/config.json`.

Dependabot weekly updates npm and GitHub Actions. Terraform/IaC scanning and Lambda zip publish stay in `sam-terraform`.

## Stack

| Piece | Where |
|---|---|
| Local portal (Next.js BFF + cookie auth) | this repo |
| Users, ACL, threads | DynamoDB (Local now; on-demand tables in AWS) |
| Hosted public edge | `sam-terraform`: CloudFront SPA + Cognito JWT + Lambda HTTP API (per env) |
| Hosted login | prod `https://login.halcyonlabs.uk`; staging `https://login.staging.halcyonlabs.uk` |
| Hosted chat | prod `wss://ws.app.halcyonlabs.uk`; staging `wss://ws.staging.halcyonlabs.uk` |
| Agent memory / transcripts | OpenClaw SQLite on the Mac |
| Models | Ollama on the Mac (`:18789` / `:11434` stay loopback) |

Hosted contract: [`sam-terraform/docs/openclaw-integration.md`](../sam-terraform/docs/openclaw-integration.md). Do **not** add ECS Fargate, RDS, or a public Gateway.
