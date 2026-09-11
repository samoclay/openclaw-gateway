# OpenClaw ↔ sam-terraform hosting contract

Infra lives in `sam-terraform`. Read these, in order:

1. `sam-terraform/docs/openclaw.md` — every AWS component, how they connect, cost
2. `sam-terraform/docs/openclaw-integration.md` — table names, JWT vs WebSocket, routes
3. `sam-terraform/docs/openclaw-admin.md` — bootstrap admin, curl recipes, sidecar, local UI

**Do not** target ECS Fargate, RDS, Tailscale EC2, or a public Gateway.

## Analytics (gated, $0 idle)

`deploy_openclaw_analytics` is **true on staging** (prod stays false). Idle lake cost is still $0 until events land. Insight tables exist with the portal; empty tenants get **demo** rows scoped to membership only.

| Concern | Contract |
|---|---|
| Identity | `tenantId` on each sandbox (`tenantId = sandboxId` in v1). Never trust `tenantId` from the browser, sidecar, or Qwen. |
| Events | CloudEvents from `@halcyon/telemetry`. Prompts/responses are rejected. Lambda stamps `tenant_id` from the sandbox row. |
| Sidecar | `{ type: "telemetry" }` after chat. Lambda **must not** `PostToConnection` it to browsers (only `delta` / `done` / `error` / `sealed`). |
| Ingest | Portal Lambda `PutRecord` to Firehose only when `FIREHOSE_STREAM_NAME` is set. Watermark is always written. |
| Serving | `GET /api/insights`, `GET /api/insights/:id`, `POST /api/insights/:id/status`, `GET /api/metrics/summary` — Dynamo only, membership-scoped. |
| Extra tables | `{prefix}insights`, `{prefix}ingest_watermarks`, `{prefix}tenant_metrics` |
| Lake | Created only by `modules/openclaw_analytics`. Portal role has **no** Athena/S3 lake read. |

Local UI: `/insights`. Hosted SPA (`site/index.html`) is PKCE login + Insights dashboard. Push openclaw branch `staging` to publish the SPA; apply `sam-terraform` `envs/staging` for Lambda seed + the analytics module.

## Local full console vs hosted edge

| Concern | This repo (`openclaw`) | `sam-terraform` |
|---|---|---|
| Full admin UI + chat UI | Yes — `apps/portal` (`npm run dev` → `/admin`, `/sandboxes/[id]`) | Workspace `#/workspace`, Insights `#/insights`, **Access** `#/admin`; chat is sealed WebSocket |
| Auth | Cookie `halcyon_session` + DynamoDB password (local) | Cognito Hosted UI + JWT |
| Chat | `POST /api/sandboxes/:id/chat` SSE → loopback Gateway | WebSocket via AWS; REST chat returns **426** |
| Reach Gateway | Portal holds `OPENCLAW_GATEWAY_TOKEN`, calls `:18789` | **Sidecar only** holds Gateway token; Lambda never does |
| Provision agent | `scripts/provision-sandbox.mjs` on sandbox create | Sidecar `{ type: "provision" }` → `openclaw agents add` |
| Publish SPA | `.github/workflows/publish.yml` packages `site/index.html` | Pins `openclaw_spa_version`, serves CloudFront |
| Publish Lambda | — | `publish-openclaw.yml` → `openclaw_lambda_version` |

**UX today:** Staging `https://staging-portal.halcyonlabs.uk` = Cognito PKCE + Workspace + Insights + `#/admin` Access. Ordinary signup → labelled Sample workspace until an admin grants membership.

```mermaid
flowchart LR
  subgraph localUX [Local_openclaw]
    AdminUI["/admin UI"]
    ChatUI["/sandboxes/id chat"]
  end
  subgraph hostedUX [Hosted_AWS]
    Landing["site/index.html Insights"]
    Cognito["Cognito login"]
    AdminAPI["/api/admin curl"]
  end
  subgraph mac [Mac]
    GW["Gateway :18789"]
  end
  AdminUI --> GW
  ChatUI --> GW
  Landing --> Cognito
  AdminAPI -->|"WSS sidecar"| GW
```

## Hosted shape

Two isolated environments (separate Terraform state, VPC, IAM, Lambda, Cognito, Dynamo, artifacts bucket):

| | Production | Staging |
|---|---|---|
| Portal | `https://portal.halcyonlabs.uk` | `https://staging-portal.halcyonlabs.uk` |
| Login | `https://login.portal.halcyonlabs.uk` | `https://login.staging-portal.halcyonlabs.uk` |
| WebSocket | `wss://ws.portal.halcyonlabs.uk` | `wss://ws.staging-portal.halcyonlabs.uk` |
| Dynamo prefix | `halcyon_` | `halcyon_staging_` |
| Apply | `cd sam-terraform/envs/production` | `cd sam-terraform/envs/staging` |
| GitHub | Environment `production` (`master`/`main`) | Environment `staging` (openclaw branch `staging`; terraform stays on `main` + `envs/staging`) |

- Cognito groups `admin` | `client` (separate user pools)
- `userId` = Cognito `sub`. Hosted users have no `passwordHash`
- Chat on AWS is WebSocket, not `POST /api/sandboxes/:id/chat` (that returns 426)
- Sidecar is the only caller of `http://127.0.0.1:18789`. `OPENCLAW_ENV=prod|staging`
- Role `agentId` slugs use the last 16 alphanumeric of `sandboxId+roleId` so they do not collide with the sandbox default. Recreate older roster roles after pinning Lambda. Composer `@Name` / display-name handoff is in `site/index.html`; staging CloudFront updates on SPA publish (`scripts/package-spa.sh`).
- Staging publish cannot `lambda:UpdateFunction*` on prod

Prod flag: `deploy_openclaw = false` in `envs/production/production.tfvars` until explicitly applied. Requires `deploy_ses = true`. Staging has no flag.

## Artifacts

| Artifact | Publisher | Pin file |
|---|---|---|
| Hosted SPA `site/index.html` | this repo `.github/workflows/publish.yml` | `openclaw_spa_version` in that env’s tfvars |
| Lambda zip | `sam-terraform` `.github/workflows/publish-openclaw.yml` | `openclaw_lambda_version` |

**SPA versions:** CloudFront pin is the **git SHA** (`openclaw_spa_version`, S3 `spa/<sha>/`). GitHub Releases are **semver**: `staging` → `vX.Y.Z-rc.N` (prerelease); merge `staging` into `master` → `vX.Y.Z`. Notes include the SHA to pin.

**Staging SPA pin PR:** After a successful upload to the staging artifacts bucket, Publish opens or updates PR branch `bots/openclaw-spa-pin` → base `main` on `samoclay/sam-terraform`, setting `openclaw_spa_version` in `envs/staging/staging.tfvars` only (staging vs prod is the `envs/` folder, not a git branch). Merge that PR to apply staging. Requires repo secret `SAM_TERRAFORM_TOKEN` (fine-grained PAT: contents + pull requests on `samoclay/sam-terraform`). Production pins stay manual in `production.tfvars`.

Next.js `apps/portal` is local-only. Empty version strings mean terraform packages from its own `functions/` tree (first apply). After apply, set GitHub Environment **Variables** from that env’s `terraform output openclaw_github_actions` (`AWS_ROLE_ARN`, `ARTIFACTS_BUCKET`) — never copy the prod role onto the staging environment.
