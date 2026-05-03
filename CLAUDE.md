# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install deps (Python 3.11+)
pip install -e ".[dev]"

# Run all tests
pytest

# Run a single test
pytest tests/test_keeperhub.py::test_pay_workflow_calls_direct_transfer -v

# Run the call-control backend (port 8080)
uvicorn src.server:app --port 8080

# Run the caller agent standalone (needs DAILY_ROOM_URL set)
python -m src.agents.caller

# Run the callee agent standalone
python -m src.agents.callee

# Run the Bella AXL responder (stand-alone, no Pipecat)
python scripts/bella_responder.py

# Run only the audio trace WebSocket server
python -m src.audio.events
```

## Architecture

**Tollgate** is "Stripe for agent-to-agent calls." A caller agent pays a micro-toll before the callee opens a negotiation channel, using three external systems: ENS (identity), Gensyn AXL (messaging), and KeeperHub (payment).

### Call flow

```
User speaks → Pipecat (STT→Gemini→TTS) → place_order tool → run_negotiation()
  Phase 0: ENS lookup          (src/ens/resolver.py)
  Phase 1: KeeperHub toll pay  (src/payments/keeperhub.py)
  Phase 2: AXL PROPOSE→ACCEPT→CONFIRM  (src/protocol/session.py + messages.py)
  Phase 3: KeeperHub settlement
```

Audio events broadcast to a WebSocket trace server (`src/audio/events.py`, port 8765) for the browser canvas (`ui/src/TracePanel.tsx` + `ui/src/audio.ts`).

### Key modules

| Path | Purpose |
|------|---------|
| `src/server.py` | FastAPI call-control API — creates Daily rooms, spawns caller agent subprocesses, manages session lifecycle |
| `src/agents/caller.py` | Alex's Pipecat voice pipeline: `DailyTransport` → `DeepgramSTT` → `GoogleLLM (Gemini)` → `DeepgramTTS` → `BeatInjector` |
| `src/agents/callee.py` | Bella's Pipecat voice pipeline (inbound) |
| `src/agents/negotiation.py` | 4-phase negotiation orchestrator; emits events to `AudioEventEmitter` |
| `src/agents/beat_injector.py` | Pipecat `FrameProcessor` that pushes raw PCM audio frames (one per character) for AXL message sonification |
| `src/protocol/session.py` | `AXLSession` — aiohttp client against the Gensyn AXL Go binary's HTTP bridge (`/topology`, `/send`, `/recv`) |
| `src/protocol/messages.py` | `ProposeMessage`, `AcceptMessage`, `ConfirmMessage` dataclasses |
| `src/protocol/toll_gate.py` | `check_toll(receipt_data)` — verifies receipt on callee side |
| `src/payments/keeperhub.py` | `KeeperHubClient` — JSON-RPC over HTTP to KeeperHub MCP server; handles both `application/json` and `text/event-stream` SSE responses |
| `src/ens/resolver.py` | `resolve_agent_records(ens_name)` — reads text records via web3.py |
| `src/ens/registrar.py` | Programmatic ENS subdomain registration under `spokenagents.eth` |
| `src/ens/agent_registry.py` | Local JSON registry at `data/agents.json` for tracking known agents |
| `src/audio/events.py` | WebSocket event server (port 8765); relays negotiation events to browser |
| `src/audio/beat_encoder.py` | Deterministic char→frequency (MD5, 200–3800 Hz), raw PCM synthesis |

### AXL integration

AXL is a Go binary — there is no Python SDK. `AXLSession` talks to it via HTTP bridge:
- `GET /topology` — health check on connect
- `POST /send` with `X-Destination-Peer-Id: <peer>` header
- `GET /recv` — 200 = message bytes, 204 = empty (polled every 0.3 s)

### KeeperHub MCP protocol

1. `POST /mcp` with `method: initialize` → get `mcp-session-id` header
2. `POST /mcp` with `method: notifications/initialized` (no response expected)
3. `POST /mcp` with `method: tools/call`, `params.name: execute_transfer`
4. Poll `get_direct_execution_status` until `status` is `completed` + `transactionHash` present

### Import style

All imports use `from src.X import ...` — never relative imports. This is enforced by hatchling's `packages = ["src"]` in `pyproject.toml`.

### Tests

- `asyncio_mode = "auto"` (pytest-asyncio) — no need for `@pytest.mark.asyncio`
- Tests mock `httpx.AsyncClient` and `web3.Web3` at unit boundaries
- Run with `TOLL_REQUIRED=false` and `ENS_FALLBACK_ENABLED=true` for integration smoke tests

## Required environment variables

See `.env.example` for full list. Critical ones:

| Variable | Purpose |
|----------|---------|
| `DAILY_API_KEY` | Daily.co — room creation |
| `DEEPGRAM_API_KEY` | STT + TTS |
| `GOOGLE_API_KEY` | Gemini LLM |
| `KEEPERHUB_API_KEY` | KeeperHub MCP payment |
| `RPC_URL` | Ethereum RPC for ENS (e.g. Infura Sepolia) |
| `SPOKENAGENTS_OWNER_KEY` | Private key for ENS subdomain registration |
| `CALLER_WALLET` / `BELLA_WALLET_ADDRESS` | Wallet addresses for Alex / Bella |
| `ALEX_AXL_NODE` / `BELLA_PEER_ID` | AXL bridge URL / peer ID |
| `TOLL_REQUIRED` | Set `false` to skip real payments in dev |
| `ENS_FALLBACK_ENABLED` | Set `true` to fall back to env vars when ENS has no records |
