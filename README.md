# Tollgate

**Stripe for agent-to-agent calls.** A paid-inbound layer for AI agents: to open a communication channel with another agent, the caller's agent pays a toll. Payment executes on-chain via KeeperHub (x402). Negotiation happens over Gensyn's AXL. Each agent's identity, price, and capabilities are published on ENS.

> Built for ETHGlobal Open Agents hackathon.

## The Problem

Every business is about to have a voice agent. The moment that's true, agent-to-agent spam becomes the next robocall crisis. Any agent can call any agent, for free, at arbitrary scale — and LLM-generated calls are cheaper to send than to listen to.

There is currently no equivalent of postage, rate-limiting, or Stripe-for-agents to regulate inbound. We built it.

**One-line pitch:** *To reach an agent, another agent has to pay. We make the toll booth.*

## How It Works

1. Alex tells his agent: *"Book me a table at Bella for Friday, party of 4."*
2. Alex's agent resolves `bella.eth` via ENS → gets AXL node, toll price, KeeperHub workflow ID.
3. Alex's agent calls Bella's agent over a LiveKit voice channel. Both agents detect they are agent-to-agent.
4. Alex's agent pays the inbound toll via KeeperHub MCP. A modem-sweep audio cue plays.
5. Both AXL nodes connect. Structured booking messages exchange: `PROPOSE → ACCEPT → CONFIRM`. R2-D2 chirps play.
6. KeeperHub executes the final deposit. A settlement chime plays.
7. Both agents summarize to their humans: *"Table held for Friday 8pm, $20 deposit, confirmation BELLA-FRI-8PM."*

End-to-end in ~30 seconds.

## Architecture

```
  Alex                                                   Bella
   |                                                       |
   |──voice──▶ [Alex's Agent] ◀───voice call───▶ [Bella's Agent] ◀──voice──|
                    │                                  │
                    │ ENS lookup: bella.eth            │
                    ├──▶ [ENS]                         │
                    │     axl.node, toll price,        │
                    │     workflow id                  │
                    │                                  │
                    │ toll payment (x402)              │
                    ├──▶ [KeeperHub MCP]               │
                    │     USDC tx ───────────────────▶ │
                    │                                  │
                    │◀══════ AXL channel opens ═══════▶│
                    │     PROPOSE / ACCEPT / CONFIRM   │
                    │                                  │
                    │ settlement                       │
                    ├──▶ [KeeperHub MCP]               │
                    │     deposit / escrow             │
                    │                                  │
```

## Sponsor Integration

### Gensyn AXL
- Two separate AXL nodes (one per agent) running the Go binary + HTTP bridge
- All negotiation messages (`PROPOSE`, `COUNTER`, `ACCEPT`, `CONFIRM`) pass over AXL
- Session lifecycle: connect on toll receipt → negotiate → close on confirm
- See: `src/protocol/session.py`, `src/protocol/messages.py`

### KeeperHub
- **Toll payment:** every inbound channel costs `contact.price` USDC, routed via `contact.workflow`
- **Settlement:** after `CONFIRM`, KeeperHub executes the booking deposit
- **Feedback bounty:** see `FEEDBACK.md` for specific, actionable integration feedback
- See: `src/payments/keeperhub.py`, `src/payments/receipt.py`

### ENS
- Both agents have `.eth` names with 6 text records: `axl.node`, `contact.price`, `contact.currency`, `contact.workflow`, `capabilities`, `agent.version`
- ENS is the directory — without it, there's no discoverable pricing or AXL node address
- `contact.price` record is a novel pattern: ENS as a public pricing/capability advertisement
- See: `src/ens/resolver.py`, `scripts/register_ens.py`

## Project Structure

```
tollgate/
├── src/
│   ├── agents/
│   │   ├── caller.py          # Alex's agent (LiveKit + OpenAI)
│   │   ├── callee.py          # Bella's agent (LiveKit + OpenAI)
│   │   └── negotiation.py     # ENS + toll + AXL integration flow
│   ├── protocol/
│   │   ├── messages.py        # AXL message schemas (PROPOSE/ACCEPT/CONFIRM)
│   │   └── session.py         # AXL HTTP bridge client
│   ├── payments/
│   │   ├── keeperhub.py       # KeeperHub MCP client
│   │   └── receipt.py         # Receipt verification
│   ├── ens/
│   │   └── resolver.py        # ENS text-record resolution
│   └── audio/
│       └── events.py          # WebSocket audio event server
├── ui/                        # React demo UI (Vite + Tone.js)
├── tests/                     # 29 passing unit tests
├── scripts/
│   ├── register_ens.py        # ENS name registration helper
│   ├── axl_smoke_test.py      # AXL node connectivity test
│   └── keeperhub_smoke_test.py # KeeperHub payment test
├── FEEDBACK.md                # KeeperHub builder feedback
└── docs/plans/                # Implementation plan
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (for UI)
- LiveKit Cloud account (free tier)
- AXL node binary (built from https://github.com/gensyn-ai/axl)
- KeeperHub API key (https://app.keeperhub.com)

### Install

```bash
git clone <repo>
cd tollgate
cp .env.example .env
# Fill in .env (see .env.example for all required vars)

python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pip install "livekit-agents[openai]>=0.8" aiohttp websockets

cd ui && npm install && cd ..
```

### Run Tests

```bash
python -m pytest tests/ -v
# 29 tests should pass
```

### Day-1 Checklist (before integration)

- [ ] Register ENS names: `python scripts/register_ens.py`
- [ ] Start two AXL nodes: see `scripts/axl_smoke_test.py` for instructions
- [ ] Test KeeperHub: `python scripts/keeperhub_smoke_test.py`
- [ ] Test voice: start callee + caller in separate terminals

### Run the Demo

Terminal 1 — AXL node (Bella):
```bash
./axl/node -config config/bella-node.json -api-port 9012
```

Terminal 2 — AXL node (Alex):
```bash
./axl/node -config config/alex-node.json
```

Terminal 3 — Audio event server + Bella's voice agent:
```bash
source .venv/bin/activate
python -m src.agents.callee dev
```

Terminal 4 — Alex's voice agent:
```bash
source .venv/bin/activate
python -m src.agents.caller dev
```

Terminal 5 — Demo UI:
```bash
cd ui && npm run dev
# Open http://localhost:5173
```

## Success Metrics

| Metric | Target | Observed |
|--------|--------|----------|
| Paid channel open | ≤ 8s | TBD |
| AXL negotiation | ≤ 5s | TBD |
| End-to-end | ≤ 30s | TBD |
| Payment reliability | ≥ 95% | TBD |

## Team

| Name | Role | Contact |
|------|------|---------|
| TBD | TBD | TBD |

## Submission Links

- Demo video: `<add link>`
- Live demo: `<add link>`
- Contract addresses: Base Sepolia — `<add addresses>`
- ENS names: `alex-tollgate.eth`, `bella-tollgate.eth`
