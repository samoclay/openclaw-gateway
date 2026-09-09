# OpenClaw ↔ sam-terraform hosting contract

Infra lives in `sam-terraform`. Read these, in order:

1. `sam-terraform/docs/openclaw.md` — every AWS component, how they connect, cost
2. `sam-terraform/docs/openclaw-integration.md` — table names, JWT vs WebSocket, routes

**Do not** target ECS Fargate, RDS, Tailscale EC2, or a public Gateway.

## Hosted shape

Two isolated environments (separate Terraform state, VPC, IAM, Lambda, Cognito, Dynamo, artifacts bucket):

| | Production | Staging |
|---|---|---|
| App | `https://app.halcyonlabs.uk` | `https://staging.halcyonlabs.uk` |
| Login | `https://login.halcyonlabs.uk` | `https://login.staging.halcyonlabs.uk` |
| WebSocket | `wss://ws.app.halcyonlabs.uk` | `wss://ws.staging.halcyonlabs.uk` |
| Dynamo prefix | `halcyon_` | `halcyon_staging_` |
| Apply | `cd sam-terraform/envs/production` | `cd sam-terraform/envs/staging` |
| GitHub Environment | `production` (`master`/`main`) | `staging` (branch `staging`) |

- Cognito groups `admin` | `client` (separate user pools)
- `userId` = Cognito `sub`. Hosted users have no `passwordHash`
- Chat on AWS is WebSocket, not `POST /api/sandboxes/:id/chat` (that returns 426)
- Sidecar is the only caller of `http://127.0.0.1:18789`. `OPENCLAW_ENV=prod|staging`
- Staging publish cannot `lambda:UpdateFunction*` on prod

Prod flag: `deploy_openclaw = false` in `envs/production/production.tfvars` until explicitly applied. Requires `deploy_ses = true`. Staging has no flag.

## Artifacts

| Artifact | Publisher | Pin file |
|---|---|---|
| Hosted SPA `site/index.html` | this repo `.github/workflows/publish.yml` | `openclaw_spa_version` in that env’s tfvars |
| Lambda zip | `sam-terraform` `.github/workflows/publish-openclaw.yml` | `openclaw_lambda_version` |

Next.js `apps/portal` is local-only. Empty version strings mean terraform packages from its own `functions/` tree (first apply). After apply, set GitHub Environment **Variables** from that env’s `terraform output openclaw_github_actions` (`AWS_ROLE_ARN`, `ARTIFACTS_BUCKET`) — never copy the prod role onto the staging environment.
