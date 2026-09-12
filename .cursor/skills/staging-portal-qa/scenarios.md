# Staging portal QA scenarios

Run these unless the user scopes narrower. Mark each Pass / Fail / Blocked.

## A. Entry and shell

1. Open `https://staging-portal.halcyonlabs.uk` (hard refresh if testing a fresh SPA publish).
2. Sign in if prompted. Note whether login copy and errors are clear.
3. Confirm chrome reads as Halcyon (gold-on-black), not a generic admin template.
4. Confirm Workspace is reachable (`#/` or `#/workspace`). Insights link works. `#/admin` only if you are an allowlisted admin — otherwise note denial/absence.

## B. Environment and Capacity

1. If multiple environments exist, switch Environment and confirm the roster/chat context changes coherently.
2. Read Capacity / host status copy. If offline, confirm chat controls are disabled with an understandable reason (not a silent dead Send).
3. If online, note model list availability under “Switch model”.

## C. Basic single-agent chat

1. Select **Captain** (or the default system agent).
2. Send a trivial message: `hi`.
3. Expect: bubble for You, then a Captain reply (quality may be poor on tiny models — still flag empty, stuck Running forever, or decrypt errors).
4. Confirm Send disables while pending and re-enables after done/error.
5. Confirm you can still click other agents in the roster while a turn is Running.

## D. Multi-agent conversation (customer activity)

1. Ensure at least one non-system agent exists (e.g. add `sam` if missing). Avoid leaving duplicate display names if that confuses selection — if duplicates already exist, treat that as a finding.
2. From Captain, send: `ask @sam to say hi` (use the real display name).
3. Expect: clear handoff behaviour — Captain and/or specialist labelled replies; Running indicator on the agent that is generating.
4. Click the specialist in the roster **during** and **after** the turn.
5. Expect: selection changes; history for that agent is understandable (empty specialist room vs shared transcript — note if the customer cannot “see what they did”).
6. Send a follow-up from the specialist’s room (e.g. `say bye`), then return to Captain. Note thread/history confusion.

## E. Roster and model controls

1. Click every agent once. Selection border must match the agent whose room you see.
2. “Switch model (Captain approval)” / Apply: change model for **one** agent only; confirm other agents’ model lines do not silently rewrite unless product says they should.
3. Add agent with a new display name; confirm it appears and is selectable.
4. Try empty Add / duplicate names — note validation or confusing duplicates.

## F. History and sample path

1. Refresh Workspace. Confirm history policy (device persistence) matches what the UI implies — no surprise wipe without action; Clear history asks confirm.
2. If you can reach a no-membership path, confirm **Sample** labelling and that you cannot touch another customer’s data.

## G. Strange-behaviour watchlist

Flag if you see any of these:

- Agent click focuses but selection does not change (especially while Running).
- Two agents with the same display name and unclear which is selected.
- Stuck Running / pending with no timeout or error.
- Model dropdown shows a large model while roster still shows `smollm` (or Apply appears to no-op).
- Garbled loops, empty sealed decrypt errors, or Capacity flip-flops mid-turn.
- Send enabled while Capacity offline, or chat against Sample presented as live.
