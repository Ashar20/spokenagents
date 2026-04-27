# Tollgate

**Stripe for agent-to-agent calls.** A paid-inbound layer for AI agents: to open a communication channel with another agent, the caller's agent pays a toll.

## Setup

```bash
cp .env.example .env
# Fill in .env values
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

## Architecture

Two agent processes (Alex = caller, Bella = callee) communicate over LiveKit voice, discover each other via ENS text records, pay an inbound toll through KeeperHub MCP, then negotiate a booking over Gensyn AXL.

## Sponsors

- **Gensyn AXL** — inter-agent negotiation transport
- **KeeperHub** — toll payment + settlement via x402
- **ENS** — agent identity, pricing, and capability discovery
