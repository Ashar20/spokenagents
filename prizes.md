# ETHGlobal Open Agents — Sponsor prize tracks (Tollgate)

---

## Submission evidence (Tollgate)

- **Live demo:** `<add link>`
- **Demo video (≤ 3 min):** `<add link>`
- **GitHub:** [`Ashar20/spokenagents`](https://github.com/Ashar20/spokenagents)
- **ENS parent:** [`spokenagents.eth` — Subnames](https://sepolia.app.ens.domains/spokenagents.eth?tab=subnames)
- **Sample agents:** [`alex.spokenagents.eth`](https://sepolia.app.ens.domains/alex.spokenagents.eth) · [`bella.spokenagents.eth`](https://sepolia.app.ens.domains/bella.spokenagents.eth) · [`wendy.spokenagents.eth`](https://sepolia.app.ens.domains/wendy.spokenagents.eth)
- **KeeperHub integration:** MCP client [`src/payments/keeperhub.py`](./src/payments/keeperhub.py) · **Builder Feedback Bounty (submission):** [`KEEPERHUB_BUILDER_FEEDBACK_BOUNTY.md`](./KEEPERHUB_BUILDER_FEEDBACK_BOUNTY.md) · Short notes [`FEEDBACK.md`](./FEEDBACK.md)
- **Gensyn AXL:** [`src/protocol/session.py`](./src/protocol/session.py) · [`scripts/bella_responder.py`](./scripts/bella_responder.py)
- **Team contact:** `<Telegram / X — add handles>`

Replace placeholders before final submission.

---

## Gensyn — Best Application of AXL ($5,000 pool)

> **About:** Gensyn powers decentralized ML compute; **AXL** is peer-to-peer agent messaging — we use it as the negotiation transport between independent nodes.

**What we ship**

- Two **separate AXL nodes** (caller + callee) with HTTP bridge (`GET /topology`, `POST /send`, polled `GET /recv`).
- Full negotiation **`PROPOSE` → (`COUNTER`) → `ACCEPT` → `CONFIRM`** over AXL — not a single ping demo.
- **No central broker** in the negotiation path.
- Code: [`src/protocol/session.py`](./src/protocol/session.py), [`src/protocol/messages.py`](./src/protocol/messages.py), [`scripts/bella_responder.py`](./scripts/bella_responder.py).

---

## ENS — $5,000 total ($2,500 + $2,500 tracks)

> **About:** ENS maps names like `yourname.eth` to identities and metadata — here it is the **agent directory**.

### Best ENS integration for AI agents — $2,500

ENS improves **functional** identity/discovery for agents (not cosmetic).

**Tollgate angle**

- Callee advertised as **`*.spokenagents.eth`** with structured **text records**: toll (`contact.price`), wallet (`contact.wallet`), workflow (`contact.workflow`), AXL routing (`axl.node`, `axl.bridge_url`), `capabilities`, `agent.version`.
- [`src/ens/resolver.py`](./src/ens/resolver.py), [`src/ens/registrar.py`](./src/ens/registrar.py).
- Registry API: `POST /api/agents/register`, `GET /api/agents` — [`src/server.py`](./src/server.py).

### Most creative use of ENS — $2,500

**Tollgate angle**

- **`contact.price` as a public on-chain toll advertisement** for AI agents — ENS doubles as pricing / capability discovery, not only name → address resolution.

---

## KeeperHub — ~$5,000 ecosystem prizes ($4,500 main + feedback bounty)

> **About:** KeeperHub provides reliable on-chain execution for agents (MCP, retries, routing, audit trails). We use it as the **toll + settlement rail**.

### Best use of KeeperHub — $4,500 pool

**Focus area 1 — Innovative use**

- Every inbound agent channel can be gated by a **real USDC transfer** via MCP (`execute_transfer` + `get_direct_execution_status` polling) — [`src/payments/keeperhub.py`](./src/payments/keeperhub.py).

**Focus area 2 — Payments**

- Payment-path integration aligned with **x402-style micropayment** storytelling on toll and settlement flows.

### Builder feedback bounty — $250

Actionable integration notes: [`FEEDBACK.md`](./FEEDBACK.md).

---

## One coherent story

Three tracks, **one build**: **ENS** discovers and prices agents → **KeeperHub** collects toll and settles → **Gensyn AXL** carries multi-round negotiation between independent nodes.

See **[README.md](./README.md)** and **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

_Prize amounts are summarized from sponsor / hackathon materials at submission time — confirm against the official ETHGlobal Open Agents site if figures change._
