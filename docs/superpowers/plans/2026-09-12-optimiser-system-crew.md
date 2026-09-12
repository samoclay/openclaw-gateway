# Cortana System Crew Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new sandbox ships non-deletable Captain + Cortana; catalog shows what models are great at and their size/RAM; members can approve Cortana proposals to pin a different live model per agent without trusting client `model` or putting prompts on AWS.

**Architecture:** Lambda provisions a system Cortana role on sandbox create and labels the primary agent Captain. Role rows carry optional per-agent `modelRef`. A sealed apply API re-provisions only that agent after membership + live-tag checks. SPA merges curated catalog metadata with live Host tags and locks system agents in the roster.

**Tech Stack:** Python portal Lambda (`handler.py`, `hosts.py`, `acl.py`), Node sidecar provision, static `site/index.html`, `@halcyon` contract packages as needed.

**Spec:** [docs/superpowers/specs/2026-09-12-optimiser-system-crew-design.md](../specs/2026-09-12-optimiser-system-crew-design.md)

## Global Constraints

- Isolation is sandbox membership; v1 `tenantId = sandboxId`; never trust `tenantId` / `agentId` / `model` from the browser.
- Prompts and responses must not be stored on AWS.
- Chat still uses `openclaw/<agentId>`; Gateway model is not client-supplied.
- SPA is a single `site/index.html`. Gold-on-black tokens only.
- Do not add Grafana, Prometheus, Fargate, RDS, or a public Gateway / Function URL.
- Captain and Cortana cannot be deleted.

## File map

| File | Responsibility |
|---|---|
| `sam-terraform/functions/openclaw_portal/system_crew.py` | Constants + helpers: cortana role factory, delete guard, apply model to role/sandbox |
| `sam-terraform/functions/openclaw_portal/test_system_crew.py` | Unit tests for system crew helpers |
| `sam-terraform/functions/openclaw_portal/handler.py` | create_sandbox dual provision; roster; DELETE guard; apply route |
| `sam-terraform/functions/openclaw_portal/hosts.py` | Optional: keep require_live_model for apply |
| `openclaw/packages/core/src/model-catalog.ts` | Curated great-at / ram guide metadata |
| `openclaw/packages/core/src/model-catalog.test.ts` | Catalog merge tests |
| `openclaw/site/index.html` | Roster locks, catalog cards, apply approval UX |
| `openclaw/docs/superpowers/specs/2026-09-12-optimiser-system-crew-design.md` | Design |
| Follow-ups Phase 3–4 | Documented at end of this plan; not required for Phase 1–2 green |

---

### Task 1: System crew helpers (pure)

**Files:**
- Create: `sam-terraform/functions/openclaw_portal/system_crew.py`
- Create: `sam-terraform/functions/openclaw_portal/test_system_crew.py`

**Interfaces:**
- `CAPTAIN_NAME = "Captain"`, `CORTANA_NAME = "Cortana"`
- `SYSTEM_CAPTAIN = "captain"`, `SYSTEM_CORTANA = "cortana"`
- `make_cortana_role(sandbox_id, model_ref, *, role_id, agent_id) -> dict`
- `is_system_role(role) -> bool`
- `assert_role_deletable(role) -> None` raises `PermissionError` if system
- `apply_model_to_sandbox(sandbox, target_role_id, model_ref) -> dict` returns updated sandbox

- [ ] **Step 1: Write failing tests** in `test_system_crew.py`
- [ ] **Step 2: Implement `system_crew.py`**
- [ ] **Step 3: Run tests** `python -m unittest test_system_crew` from `functions/openclaw_portal`

---

### Task 2: Provision Cortana on create + roster + delete guard

**Files:**
- Modify: `handler.py` (`create_sandbox`, `_roster`, `_handle_roles`)

- [ ] **Step 1: Tests** — create path includes cortana role; DELETE system role → 403; GET roster shows Captain display name
- [ ] **Step 2: `create_sandbox`** — set display via roster defaultRole name Captain; append cortana role; dual `_post_ws` provision
- [ ] **Step 3: `_handle_roles`** — support DELETE; call `assert_role_deletable`; block deleting cortana
- [ ] **Step 4: Run portal unit tests**

---

### Task 3: Sealed apply model endpoint (Phase 2)

**Files:**
- Modify: `handler.py` — `POST /api/sandboxes/{id}/agents/model` (or `/roles/{roleId}/model`)
- Modify: `system_crew.py` — apply helper
- Modify: tests

**Behavior:**
- Body: `{ "roleId": "default" | "<id>", "modelRef": "ollama/..." }` (optional `capacityMode` / `pinnedHostId` stubbed no-op until Phase 4)
- Membership required; `require_live_model`; update role or sandbox modelRef; provision that agent only
- Never accept client chat `model`

- [ ] **Step 1: Failing handler/acl tests**
- [ ] **Step 2: Implement route + provision**
- [ ] **Step 3: Run tests**

---

### Task 4: Curated model catalog (openclaw)

**Files:**
- Create: `packages/core/src/model-catalog.ts`
- Create: `packages/core/src/model-catalog.test.ts`
- Export from package index if present

- [ ] **Step 1: Failing tests** for merge(live, curated)
- [ ] **Step 2: Implement curated map + `enrichModels(live)`**
- [ ] **Step 3: `npm test` in core package / workspace**

---

### Task 5: SPA — catalog + system roster + approve/apply

**Files:**
- Modify: `site/index.html`

- [ ] **Step 1: Merge catalog metadata into Access model select and Workspace agent model line**
- [ ] **Step 2: Hide delete for `systemRole`; label Captain / Cortana**
- [ ] **Step 3: Approval affordance** — when Cortana posts a propose (or member opens “Switch model”), call sealed apply after confirm
- [ ] **Step 4: Manual smoke** — sample workspace unchanged; member roster shows two system agents

---

### Task 6: Phase 3–4 stubs (docs only in this change set)

- [ ] **Step 1: Append follow-up section** (below) confirming Phase 3 measured Insights + Phase 4 host pin proposals are deferred
- [ ] **Step 2: Optional Insight category constant** `model_switch_measured` reserved in comments / bi stub if cheap

---

## Follow-ups (Phase 3–4)

**Phase 3 — Evidence loop**

- After apply, stamp telemetry; BI job or lightweight counter writes Insight `status: measured` with failure/latency delta.
- SPA Insights: one optional sparkline from Dynamo `series` when API returns it.
- Still no Grafana.

**Phase 4 — Host capacity**

- Extend apply body with `capacityMode` / `pinnedHostId`; reuse `pick_host` / Access capacity rules.
- Cortana `capacityHint` becomes actionable.

---

## Done when

- Unit tests green for system_crew + apply + catalog.
- New sandbox provisions Cortana; cannot delete system agents.
- Member can apply a live model to one agent via sealed API.
- SPA shows great-at + size for catalog tags.
- Phases 3–4 documented as follow-ups only.
