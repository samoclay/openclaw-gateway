# New Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Access creates a New Sandbox whose model is a live pulled tag; pool assign only uses hosts that have that tag; Access shows Compact / Standard / Large bands.

**Architecture:** Sidecar hello adds `models[{tag,size}]` from loopback Ollama tags. Lambda stores them on the live row, lists them on `GET /api/admin/hosts`, and filters `pick_host` / provision by sandbox `modelRef`. The SPA replaces the free-text model field with a select and renames the form.

**Tech Stack:** Python `hosts.py` + handler, Node sidecar, static `site/index.html`. Depends on multi-host registry (`list_live`, `pick_host`, Access Capacity).

**Spec:** [docs/superpowers/specs/2026-09-11-new-sandbox-design.md](../specs/2026-09-11-new-sandbox-design.md)

## Global Constraints

- Isolation is sandbox membership; v1 `tenantId = sandboxId`; never trust `tenantId` / `agentId` / `model` / `hostId` from the browser.
- Prompts and responses must not be stored. Telemetry may include `host_id`, tokens, request counts, `model` from the sandbox row.
- Hop: X25519 + AES-256-GCM; AAD `sandboxId:threadId`; Lambda never decrypts.
- SPA is a single `site/index.html`. Gold-on-black tokens only.
- Host app does not start the sidecar. Shared SSM sidecar token stays Halcyon-only.
- Pinned sandbox: no silent failover. Pool must not spill to a host missing the sandbox model.
- Do not add Fargate, RDS, or a public Gateway.
- Do not store a currency rate. Do not add a Workspace model picker.

## File map

| File | Responsibility |
|---|---|
| `sam-terraform/functions/openclaw_portal/hosts.py` | Normalize ref, sanitize models, band, filter live, pick with model |
| `sam-terraform/functions/openclaw_portal/test_hosts.py` | Catalog + picker tests |
| `sam-terraform/functions/openclaw_portal/handler.py` | Hello merge models; create 400 if model unavailable |
| `sam-terraform/functions/openclaw_sidecar/sidecar.mjs` | Fetch tags; send `models` on crypto hello |
| `openclaw/site/index.html` | New Sandbox form; model select; bands |

---

### Task 1: Model catalog helpers (pure)

**Files:**
- Modify: `sam-terraform/functions/openclaw_portal/hosts.py`
- Modify: `sam-terraform/functions/openclaw_portal/test_hosts.py`

**Interfaces:**
- Produces: `normalize_model_ref(s) -> str`, `sanitize_models(raw) -> list`, `model_band(size) -> str`, `host_has_model(row, model_ref) -> bool`, `hosts_for_model(live, model_ref) -> list`, `union_models(live) -> list`

- [ ] **Step 1: Write the failing tests** (append to `test_hosts.py`)

```python
    def test_normalize_model_ref(self):
        self.assertEqual(normalize_model_ref("qwen3.6:latest"), "ollama/qwen3.6:latest")
        self.assertEqual(normalize_model_ref("  ollama/qwen3.6:latest  "), "ollama/qwen3.6:latest")
        with self.assertRaises(ValueError):
            normalize_model_ref("")

    def test_sanitize_and_union(self):
        raw = [
            {"tag": "smollm:135m", "size": 90_000_000},
            {"name": "ignored"},
            {"tag": "", "size": 1},
        ]
        self.assertEqual(
            sanitize_models(raw),
            [{"tag": "smollm:135m", "size": 90_000_000}],
        )
        a = {
            "kind": "sidecar",
            "pubKey": "p",
            "hostId": "h1",
            "hostname": "Studio",
            "models": [{"tag": "smollm:135m", "size": 90_000_000}, {"tag": "qwen3.6:latest", "size": 500_000_000}],
        }
        b = {
            "kind": "sidecar",
            "pubKey": "p",
            "hostId": "h2",
            "hostname": "Laptop",
            "models": [{"tag": "smollm:135m", "size": 90_000_000}],
        }
        tags = {m["tag"] for m in union_models([a, b])}
        self.assertEqual(tags, {"smollm:135m", "qwen3.6:latest"})

    def test_bands(self):
        self.assertEqual(model_band(90_000_000), "compact")
        self.assertEqual(model_band(200 * 1024 * 1024), "standard")
        self.assertEqual(model_band(400 * 1024 * 1024), "standard")
        self.assertEqual(model_band(400 * 1024 * 1024 + 1), "large")

    def test_pool_filters_to_hosts_with_tag(self):
        a = {
            "kind": "sidecar",
            "pubKey": "p",
            "hostId": "h1",
            "hostname": "A",
            "models": [{"tag": "smollm:135m", "size": 1}],
        }
        b = {
            "kind": "sidecar",
            "pubKey": "p",
            "hostId": "h2",
            "hostname": "B",
            "models": [{"tag": "qwen3.6:latest", "size": 2}],
        }
        sb = {"capacityMode": "pool", "modelRef": "ollama/qwen3.6:latest"}
        hit = pick_host(sb, {}, [a, b])
        self.assertEqual(hit["hostId"], "h2")
        self.assertIsNone(pick_host({"capacityMode": "pool", "modelRef": "ollama/missing"}, {}, [a, b]))
        pin_miss = pick_host(
            {"capacityMode": "pin", "pinnedHostId": "h1", "modelRef": "ollama/qwen3.6:latest"},
            {},
            [a, b],
        )
        self.assertIsNone(pin_miss)
```

- [ ] **Step 2: Run tests — expect FAIL** (imports / functions missing)

```bash
cd sam-terraform/functions/openclaw_portal
python3 -m unittest test_hosts.py -v
```

- [ ] **Step 3: Implement in `hosts.py`**

```python
COMPACT_MAX = 200 * 1024 * 1024
LARGE_MIN = 400 * 1024 * 1024
MODEL_CAP = 32


def normalize_model_ref(name: str) -> str:
    trimmed = (name or "").strip()
    if not trimmed:
        raise ValueError("modelRef is required")
    if trimmed.startswith("ollama/"):
        return trimmed
    return "ollama/" + trimmed


def _tag_key(tag: str) -> str:
    t = (tag or "").strip()
    if t.startswith("ollama/"):
        t = t[7:]
    return t


def sanitize_models(raw) -> list:
    out = []
    seen = set()
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        tag = str(item.get("tag") or "").strip()
        if not tag or tag in seen:
            continue
        try:
            size = int(item.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        if size < 0:
            size = 0
        seen.add(tag)
        out.append({"tag": tag, "size": size})
        if len(out) >= MODEL_CAP:
            break
    return out


def model_band(size_bytes: int) -> str:
    try:
        n = int(size_bytes)
    except (TypeError, ValueError):
        return "standard"
    if n > LARGE_MIN:
        return "large"
    if n >= COMPACT_MAX:
        return "standard"
    return "compact"


def host_has_model(row: dict, model_ref: str) -> bool:
    want = _tag_key(model_ref)
    if not want:
        return True
    for item in row.get("models") or []:
        if _tag_key(str(item.get("tag") or "")) == want:
            return True
    return False


def hosts_for_model(live: list, model_ref: str) -> list:
    ref = (model_ref or "").strip()
    if not ref:
        return list(live or [])
    return [row for row in live or [] if host_has_model(row, ref)]


def union_models(live: list) -> list:
    by_tag = {}
    for row in live or []:
        for item in sanitize_models(row.get("models")):
            prev = by_tag.get(item["tag"])
            if not prev or item["size"] > prev["size"]:
                by_tag[item["tag"]] = item
    return sorted(by_tag.values(), key=lambda m: m["tag"].lower())
```

Change `pick_host` so the first line after resolving `live` is:

```python
    live = hosts_for_model(live, (sandbox or {}).get("modelRef") or "")
```

Change `crypto_hello_merge` success dict to include `"models": sanitize_models((body or {}).get("models"))`.

Change `admin_hosts_body` each host to include `"models": sanitize_models(row.get("models"))`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
python3 -m unittest discover -s functions/openclaw_portal -p "test_*.py"
```

- [ ] **Step 5: Commit** on the feature branch (do not push unless asked)

---

### Task 2: Create rejects unknown model

**Files:**
- Modify: `sam-terraform/functions/openclaw_portal/handler.py` (`create_sandbox` / POST `/api/admin/sandboxes`)
- Modify: `sam-terraform/functions/openclaw_portal/test_hosts.py` (helper) or a thin `require_live_model` test

**Interfaces:**
- Consumes: `normalize_model_ref`, `hosts_for_model`, `list_live`
- Produces: create/PATCH raise `ValueError("model_unavailable")` when no live host has the ref; pin + missing tag on that host same error

- [ ] **Step 1: Add helper + test**

```python
def require_live_model(sandbox_fields: dict, live: list) -> str:
    ref = normalize_model_ref(str((sandbox_fields or {}).get("modelRef") or ""))
    eligible = hosts_for_model(list_live(live), ref)
    if (sandbox_fields or {}).get("capacityMode") == "pin":
        pinned = (sandbox_fields or {}).get("pinnedHostId")
        eligible = [row for row in eligible if row.get("hostId") == pinned]
    if not eligible:
        raise ValueError("model_unavailable")
    return ref
```

```python
    def test_require_live_model(self):
        live = [{
            "kind": "sidecar",
            "pubKey": "p",
            "hostId": "h1",
            "hostname": "A",
            "models": [{"tag": "smollm:135m", "size": 1}],
        }]
        self.assertEqual(
            require_live_model({"modelRef": "smollm:135m", "capacityMode": "pool"}, live),
            "ollama/smollm:135m",
        )
        with self.assertRaises(ValueError):
            require_live_model({"modelRef": "qwen3.6:latest", "capacityMode": "pool"}, live)
```

- [ ] **Step 2: FAIL then implement helper in `hosts.py`**
- [ ] **Step 3: In POST `/api/admin/sandboxes` and `create_sandbox` callers, after `capacity_fields`, set `modelRef` via `require_live_model({**fields, "modelRef": body.get("modelRef")}, list_sidecar_connections())`.** PATCH sandbox that includes `modelRef` uses the same helper. Empty/omitted modelRef on PATCH leaves the existing ref.
- [ ] **Step 4: Full portal unittest suite PASS**
- [ ] **Step 5: Commit**

---

### Task 3: Sidecar hello sends models

**Files:**
- Modify: `sam-terraform/functions/openclaw_sidecar/sidecar.mjs`
- Optional create: `sam-terraform/functions/openclaw_sidecar/ollama-tags.mjs` (export `readOllamaModels` for a one-liner test)

**Interfaces:**
- Produces: crypto hello `{ type, pubKey, hostId, hostname, models: [{ tag, size }] }`
- Ollama: `GET http://127.0.0.1:11434/api/tags` timeout 2000ms. Empty list on failure.

- [ ] **Step 1: Add `readOllamaModels`**

```javascript
export async function readOllamaModels(fetchImpl = fetch) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 2000);
  try {
    const res = await fetchImpl("http://127.0.0.1:11434/api/tags", { signal: ac.signal });
    if (!res.ok) return [];
    const body = await res.json();
    const out = [];
    for (const row of body.models || []) {
      const tag = String(row.name || "").trim();
      if (!tag) continue;
      out.push({ tag, size: Number(row.size) || 0 });
      if (out.length >= 32) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: `sendCryptoHello` becomes async:** `const models = await readOllamaModels();` include `models` in the JSON. Identity fail-closed unchanged (no hello if hostId/hostname empty).
- [ ] **Step 3: Verify with a node one-liner** that a fake fetch returning `{ models: [{ name: "smollm:135m", size: 9 }] }` yields that tag; a rejected fetch yields `[]`.
- [ ] **Step 4: Commit**

Do not start the sidecar from Halcyon Host.

---

### Task 4: Access New Sandbox UI

**Files:**
- Modify: `openclaw/site/index.html` (`renderAdmin`, `#new-box`)

**Interfaces:**
- Consumes: `GET /api/admin/hosts` `{ hosts: [{ hostname, hostId, status, models: [{ tag, size }] }] }`

- [ ] **Step 1: Add helpers next to `pinOptions`**

```javascript
function displayTag(tag) {
  const t = String(tag || "");
  return t.indexOf("ollama/") === 0 ? t.slice(7) : t;
}
function modelBand(size) {
  const n = Number(size) || 0;
  if (n > 400 * 1024 * 1024) return "large";
  if (n >= 200 * 1024 * 1024) return "standard";
  return "compact";
}
function bandHint(band) {
  if (band === "large") return " — higher capacity";
  if (band === "compact") return " — lower capacity";
  return "";
}
function unionModels(hosts, pinHostId) {
  const src = (hosts || []).filter(function (h) {
    return !pinHostId || h.hostId === pinHostId;
  });
  const by = {};
  src.forEach(function (h) {
    (h.models || []).forEach(function (m) {
      const tag = m.tag || "";
      if (!tag) return;
      if (!by[tag] || (m.size || 0) > (by[tag].size || 0)) by[tag] = m;
    });
  });
  return Object.keys(by).sort().map(function (k) { return by[k]; });
}
```

- [ ] **Step 2: Rename the card** to `<h2>New Sandbox</h2>` and muted copy: `Creates an isolated environment. Not a host.`
- [ ] **Step 3: Replace the Model `<input>`** with a `<select name="modelRef">`. Options from `unionModels(hosts, capacity===pool ? "" : selectedPinId)`. Each option `value="ollama/"+tag` (if tag lacks prefix), label `displayTag + " — " + capitalized band + bandHint`. If `unionModels` is empty, disable Create and the select.
- [ ] **Step 4: On Capacity change** (create form), rebuild model options. If the current model is not in the new list, select the first remaining option.
- [ ] **Step 5: POST body** still `{ name, modelRef, capacity }` / `capacityMode` + `pinnedHostId` as today. `modelRef` from the select only.
- [ ] **Step 6: Sandbox cards** show `displayTag(box.modelRef)` plus band if that tag is in the live union.
- [ ] **Step 7: Workspace** — do not add a model picker.
- [ ] **Step 8: `npm test` in openclaw** (existing package tests). No bundler.
- [ ] **Step 9: Commit**

---

### Task 5: Verify

- [ ] `python3 -m unittest discover -s functions/openclaw_portal -p "test_*.py"`
- [ ] `npm test` in openclaw
- [ ] Do not push/apply unless asked. Live check: two hosts with different tags; Pool + large tag assigns only the host that has it; Pin + missing tag cannot Create.

---

## Spec coverage

| Spec | Task |
|---|---|
| normalize / sanitize / bands | T1 |
| hello `models[]`, admin hosts | T1 (merge/body) + T3 |
| pick_host filter, no spill | T1 |
| create 400 `model_unavailable` | T2 |
| New Sandbox select, empty disable | T4 |
| Workspace unchanged | T4 |
| sidecar tags fetch | T3 |
| No invoices / rates | all (not added) |
