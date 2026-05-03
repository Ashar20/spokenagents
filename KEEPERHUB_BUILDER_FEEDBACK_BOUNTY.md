# KeeperHub — Builder Feedback Bounty submission

**Project:** Tollgate ([`Ashar20/spokenagents`](https://github.com/Ashar20/spokenagents))  
**Integration surface:** MCP over HTTP — `initialize` → `notifications/initialized` → `tools/call` (`execute_transfer`, `get_direct_execution_status`)  
**Primary code:** [`src/payments/keeperhub.py`](./src/payments/keeperhub.py)  
**Smoke / probe:** [`scripts/keeperhub_smoke_test.py`](./scripts/keeperhub_smoke_test.py), [`scripts/keeperhub_probe.py`](./scripts/keeperhub_probe.py)

This document is written to match the bounty ask: **specific, actionable** feedback across **at least one** of: UX/UI friction, reproducible bugs, documentation gaps, and feature requests. (We cover all four.)

---

## 1. UX and UI friction (developer + product surfaces)

### 1.1 “Is this JSON or SSE?” — response shape ambiguity

The MCP HTTP transport can return **`Content-Type: application/json`** or **`text/event-stream`**. Tool results for the same logical call (`tools/call`) showed up both ways during integration. That forces every client to branch on `Content-Type`, buffer the body, and for SSE parse `data:` lines.

**Friction:** First-time integrators assume one response format. We burned time on `JSONDecodeError` before we noticed streaming frames.

**Actionable fix:** Pick one default for synchronous `tools/call` responses **or** document prominently: “Always send `Accept: application/json, text/event-stream` and implement the dual parser.” Ship a minimal reference client (Python + TypeScript) in the docs sidebar.

### 1.2 Session bootstrap is easy to get wrong (`mcp-session-id` + ordering)

Successful calls require:

1. `POST /mcp` with `method: initialize` → read `mcp-session-id` response header  
2. `POST /mcp` with `method: notifications/initialized` **with** that header  
3. Only then `tools/call`

If step 2 is skipped, reordered, or session id omitted, failures are often **opaque** (generic 4xx/5xx or empty tool content).

**Friction:** MCP is standard, but **this exact sequence** is not discoverable from a single “Quickstart” page. We added an `asyncio.Lock` in our client because partial init races happened under parallel first calls.

**Actionable fix:** A one-screen **“MCP over HTTP checklist”** diagram (initialize → initialized → tools/call) with the **required headers** highlighted, plus the exact error the server returns for each mistake.

### 1.3 Polling ergonomics (`get_direct_execution_status`)

`execute_transfer` returns an `executionId`, but a **completed** logical state can arrive **before** `transactionHash` is populated. Our client **must** poll with backoff until `(status terminal) OR (success + tx_hash)` — see comment in [`keeperhub.py`](./src/payments/keeperhub.py) (“always poll at least once”).

**Friction:** Naive integrators stop on `status=completed` and ship a broken “receipt.”

**Actionable fix:** Document the state machine explicitly: allowed `status` values, which combinations include `transactionHash`, and recommended poll intervals. A tiny state diagram in docs would prevent an entire class of bugs.

---

## 2. Reproducible bugs / sharp edges

### 2.1 “Completed” without `transactionHash` (polling required)

**Observed behavior:** First `execute_transfer` response sometimes reports **success/completed-class status** without a `transactionHash`. Polling `get_direct_execution_status` with the same `execution_id` later yields the hash.

**Why it matters:** Any agent that gates the next step (for us: open AXL channel) on **“I have a tx hash”** will deadlock or fail if it trusts the first response only.

**Minimal client-side mitigation (what we shipped):** loop until timeout; treat missing hash as incomplete.

**Suggested server-side improvement:** Either always block `execute_transfer` until the hash is known, or return a distinct `status` like `confirming` until `transactionHash` is present so clients don’t misread `completed`.

### 2.2 Tool result envelope is deeply nested and sometimes non-JSON text

Path in practice: `result.content[0].text` → sometimes JSON string, sometimes empty, sometimes non-JSON. Our `_call_tool` defensively handles empty / non-JSON (`{"_raw": text}`).

**Repro direction for KeeperHub:** Call any tool that returns an error or empty content; clients that `json.loads` blindly will crash.

**Ask:** Publish a **JSON schema** for the **MCP tool response wrapper** (not just business payload) so generated clients don’t guess.

*(We have unit coverage for SSE parsing in [`tests/test_keeperhub.py`](./tests/test_keeperhub.py) — good for regressions on our side, not a substitute for upstream schema docs.)*

---

## 3. Documentation gaps

### 3.1 Parameter schema for MCP tools (`execute_transfer`, `get_direct_execution_status`)

We inferred parameter names (`network`, `recipient_address`, `amount`, `token_address`, `execution_id`) from experimentation and errors. The **AI tools** / MCP marketing pages explain *that* tools exist, not the **exact argument object** each tool expects.

**Ask:** One page per tool: required fields, types, constraints, example `tools/call` JSON bodies, and example **success + error** payloads (JSON and SSE variants).

### 3.2 Testnet / sandbox story

Under hackathon pressure, teams need a **documented** path: which chain(s), which USDC address, faucet links, rate limits, and whether the same `app.keeperhub.com/mcp` URL is correct for test.

**Ask:** A “Hackathon quickstart” box: env vars, chain id, token address table, and **expected latency band** so teams can set architecture expectations (our “paid channel open” SLO struggled when every step is an on-chain transfer).

### 3.3 Receipt verification and trust model

Our MVP receipt type is `Receipt(tx_hash, signed_receipt, status)` — we currently **trust** `status == "confirmed"` for gating (`receipt.py`). Docs should state:

- What `signed_receipt` / `executionId` attests to  
- How a **callee** can verify independently (explorer link? calldata decode? signed attestation?)  
- Enumeration of **all** `status` values returned by polling

---

## 4. Feature requests (would have accelerated our build)

1. **`simulate: true` (or `dry_run`) on transfers** — Validate args + return a structured mock `executionId` / receipt **without** sending a tx. Critical for CI and for LLM agents that need to rehearse flows.

2. **Structured errors everywhere** — Replace generic messages with `{ "code": "...", "detail": {...}, "hint": "..." }` for: unknown tool, bad chain, insufficient balance, invalid token, missing session header.

3. **Webhook or SSE subscribe on execution id** — Push terminal state + `transactionHash` instead of exponential backoff polling (reduces client complexity and race bugs).

4. **Published workflow discovery** — If KeeperHub workflows are first-class (`contact.workflow` on ENS points at them), expose a **search/list** API so third parties can discover reusable “inbound toll” patterns without DMing the workflow author.

5. **Optional channel credit / balance API** — For sub-second agent routing, document (or productize) an off-chain debit pattern so every inbound negotiation isn’t blocked on cold-chain latency.

6. **ENS + KeeperHub cookbook** — Short recipe: store workflow id + treasury wallet in text records; caller resolves ENS → calls MCP → passes receipt hash forward. This matches Tollgate’s architecture directly.

---

## 5. What worked well (balance)

- **MCP as the integration boundary** fits agent tooling mental models; wrapping `execute_transfer` in our negotiation orchestrator was straightforward once parsing/session issues were solved.
- **`executionId` + poll** is a simple reliability primitive compared to rolling our own nonce/gas/retry logic on mobile hackathon timelines.

---

## 6. Summary table (bounty mapping)

| Category | Topics |
|----------|--------|
| **UX / friction** | Dual JSON/SSE responses; MCP init ordering; polling semantics when hash is delayed |
| **Bugs / sharp edges** | “Completed” without `transactionHash`; fragile parsing of `result.content` |
| **Docs gaps** | Tool argument schemas; testnet matrix; receipt verification story |
| **Features** | `simulate`, structured errors, webhooks, workflow discovery, credits pattern, ENS cookbook |

---

*Submitted by the Tollgate team as honest builder feedback during ETHGlobal Open Agents. Amounts on the hackathon prize page supersede any figures cited elsewhere in the repo.*
