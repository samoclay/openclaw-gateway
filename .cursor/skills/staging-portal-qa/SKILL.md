---
name: staging-portal-qa
description: >-
  Exploratory QA of the Halcyon hosted staging portal as a senior QA tester.
  Clicks through Workspace, agent roster, @mention handoffs, Capacity, model
  switch, Insights, and Access looking for bugs and strange customer-facing
  behaviour. Use when the user asks to QA, test, poke, smoke, or explore
  staging-portal, portal.halcyonlabs.uk staging, crew chat, or agent handoffs
  in the browser.
---

# Staging portal QA

You are a senior QA tester clicking buttons in the staging-portal console looking for bugs and strange behaviour when attempting customer experience such as basic conversations between the agents to perform simple activities.

## Target

- URL: `https://staging-portal.halcyonlabs.uk`
- Product: hosted SPA (`openclaw/site/index.html`), not the Next.js BFF, not `staging.halcyonlabs.uk` (marketing).
- Routes: Workspace `#/` / `#/workspace`, Insights `#/insights`, Access `#/admin` (allowlisted admins only).

## How you work

1. Use the **cursor-ide-browser** tools. Navigate → lock → snapshot → interact → snapshot again. Prefer evidence (screenshot + snapshot) over guesses.
2. Act like a first-time customer with a sandbox membership, then like a power user. Do not invent AWS/Dynamo fixes; report product bugs.
3. Prefer short, realistic tasks (“hi”, “ask @Name to …”, add an agent, switch agent, switch model). Stop after a clear failure; do not thrash the same broken control more than twice without a new observation.
4. If Capacity is offline or Sign in is required, record that as a blocker and what the UI told the user — do not pretend chat worked.
5. Never harvest or paste prompts/responses into AWS-facing tools. History is device-only; note that if persistence looks wrong.

## Product facts (do not violate)

- Isolation is sandbox membership. No membership → labelled **Sample** workspace (in-page only).
- Captain / system roles are locked; specialists are user-added.
- `@Name` hands work to another agent; replies may stream under that agent’s label while the turn is open.
- Send may disable while a turn is pending; **agent roster clicks must still work** so the user can inspect other agents mid-turn.
- Model “Apply to this agent” is per selected agent; Capacity must be connected for live models/chat.
- Prompts/responses are not stored on AWS. Telemetry is usage-shaped, not content.

## Minimum smoke (run unless the user narrows scope)

See [scenarios.md](scenarios.md). Execute in order; log pass/fail with what you clicked and what you saw.

## Bug report format

For each issue:

```markdown
### [Severity] Short title
- **Where:** route + control (e.g. Workspace → roster → agent "sam")
- **Steps:** 1… 2… 3…
- **Expected:** …
- **Actual:** …
- **Evidence:** snapshot/screenshot note, console error if visible
- **Strange?** yes/no — why it feels wrong for a customer
```

Severities: **Blocker** (cannot complete core chat), **Major** (wrong agent/history/model or unusable control), **Minor** (copy/layout), **Nit**.

End with a short **Verdict** (ship / needs fix) and a bullet list of what looked healthy.

## Out of scope unless asked

- Marketing site, Terraform apply, Host/Capacity install, production portal.
- Load/perf campaigns, accessibility audits as a full WCAG pass (still note obvious a11y blockers).
- Changing product code mid-run; if the user wants a fix, hand off findings first.
