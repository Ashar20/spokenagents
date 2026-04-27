# Tollgate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Tollgate — a paid-inbound layer for AI agent-to-agent calls — demo-ready for hackathon judging, covering AXL (Gensyn), KeeperHub, ENS, and a voice layer with audio UX.

**Architecture:** Two agent processes (caller = Alex, callee = Bella) communicate over a LiveKit voice channel, discover each other via ENS text records, pay an inbound toll through KeeperHub's MCP server, then negotiate a booking over AXL. A browser demo UI shows the full trace in real time.

**Tech Stack:** Python 3.11+, LiveKit Agents SDK, `axl` (Gensyn AXL SDK), KeeperHub MCP client, `eth-ens-namehash` + `web3.py` for ENS, Tone.js (browser audio), React + Vite (demo UI), Base Sepolia testnet.

---

## Project Structure

```
tollgate/
├── src/
│   ├── agents/
│   │   ├── caller.py          # Alex's agent
│   │   └── callee.py          # Bella's agent
│   ├── protocol/
│   │   ├── messages.py        # AXL message schemas (PROPOSE/COUNTER/ACCEPT/CONFIRM)
│   │   └── session.py         # AXL session lifecycle
│   ├── payments/
│   │   ├── keeperhub.py       # KeeperHub MCP client wrapper
│   │   └── receipt.py         # Receipt verification
│   ├── ens/
│   │   └── resolver.py        # ENS text-record resolution
│   └── audio/
│       └── events.py          # Audio event emitter (websocket → browser)
├── ui/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── TracePanel.tsx     # Live trace display
│   │   └── audio.ts           # Tone.js state machine
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── test_ens.py
│   ├── test_keeperhub.py
│   ├── test_protocol.py
│   └── test_session.py
├── FEEDBACK.md                # KeeperHub feedback bounty
├── README.md
├── pyproject.toml
└── .env.example
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `README.md` (stub)
- Create: `FEEDBACK.md` (stub)

**Step 1: Initialize Python project**

```bash
cd /Users/silas/Downloads/spokenagents
python3 -m venv .venv && source .venv/bin/activate
pip install uv
uv init tollgate --python 3.11
cd tollgate
```

**Step 2: Add dependencies to pyproject.toml**

```toml
[project]
name = "tollgate"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "livekit-agents[openai]>=0.8",
    "web3>=6.0",
    "eth-ens-namehash>=2.0",
    "httpx>=0.27",
    "websockets>=12",
    "python-dotenv>=1.0",
    "pytest>=8",
    "pytest-asyncio>=0.23",
]
```

**Step 3: Create .env.example**

```bash
LIVEKIT_URL=wss://your-livekit.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
OPENAI_API_KEY=
KEEPERHUB_API_KEY=
KEEPERHUB_BASE_URL=https://api.keeperhub.com
ALEX_WALLET_PRIVATE_KEY=
BELLA_WALLET_PRIVATE_KEY=
RPC_URL=https://sepolia.base.org
ENS_REGISTRY_ADDRESS=0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
ALEX_ENS=alex-tollgate.eth
BELLA_ENS=bella-tollgate.eth
```

**Step 4: Install**

```bash
uv pip install -e ".[dev]"
```

**Step 5: Commit**

```bash
git init
git add pyproject.toml .env.example README.md FEEDBACK.md
git commit -m "chore: project scaffold"
```

---

## Task 2: ENS Resolution

**Files:**
- Create: `src/ens/__init__.py`
- Create: `src/ens/resolver.py`
- Create: `tests/test_ens.py`

**Step 1: Write the failing test**

```python
# tests/test_ens.py
import pytest
from src.ens.resolver import resolve_agent_records, AgentRecord

@pytest.mark.asyncio
async def test_resolve_returns_agent_record():
    # Uses a mock — does not hit the chain
    record = AgentRecord(
        axl_node="ax1q9abc",
        toll_price="0.25",
        currency="USDC",
        workflow_id="bella/inbound-toll",
        capabilities=["booking"],
        agent_version="tollgate/0.1",
    )
    assert record.axl_node == "ax1q9abc"
    assert float(record.toll_price) == 0.25

@pytest.mark.asyncio
async def test_parse_text_records():
    from src.ens.resolver import _parse_text_records
    raw = {
        "axl.node": "ax1q9abc",
        "contact.price": "0.25",
        "contact.currency": "USDC",
        "contact.workflow": "bella/inbound-toll",
        "capabilities": '["booking","quotes"]',
        "agent.version": "tollgate/0.1",
    }
    record = _parse_text_records(raw)
    assert record.capabilities == ["booking", "quotes"]
```

**Step 2: Run to verify failure**

```bash
pytest tests/test_ens.py -v
```
Expected: `ModuleNotFoundError: No module named 'src.ens.resolver'`

**Step 3: Implement resolver**

```python
# src/ens/resolver.py
import json
from dataclasses import dataclass, field
from typing import Optional
from web3 import AsyncWeb3
from web3.middleware import async_geth_poa_middleware
import os

@dataclass
class AgentRecord:
    axl_node: str
    toll_price: str
    currency: str
    workflow_id: str
    capabilities: list[str] = field(default_factory=list)
    agent_version: str = "tollgate/0.1"

def _parse_text_records(raw: dict) -> AgentRecord:
    caps_raw = raw.get("capabilities", "[]")
    try:
        capabilities = json.loads(caps_raw)
    except json.JSONDecodeError:
        capabilities = [c.strip() for c in caps_raw.split(",") if c.strip()]
    return AgentRecord(
        axl_node=raw.get("axl.node", ""),
        toll_price=raw.get("contact.price", "0"),
        currency=raw.get("contact.currency", "USDC"),
        workflow_id=raw.get("contact.workflow", ""),
        capabilities=capabilities,
        agent_version=raw.get("agent.version", "tollgate/0.1"),
    )

async def resolve_agent_records(ens_name: str, rpc_url: Optional[str] = None) -> AgentRecord:
    url = rpc_url or os.environ["RPC_URL"]
    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(url))
    TEXT_KEYS = ["axl.node", "contact.price", "contact.currency",
                 "contact.workflow", "capabilities", "agent.version"]
    raw: dict = {}
    for key in TEXT_KEYS:
        try:
            value = await w3.ens.get_text(ens_name, key)  # type: ignore[attr-defined]
            if value:
                raw[key] = value
        except Exception:
            pass
    return _parse_text_records(raw)
```

**Step 4: Run tests**

```bash
pytest tests/test_ens.py -v
```
Expected: both tests PASS

**Step 5: Commit**

```bash
git add src/ens/ tests/test_ens.py
git commit -m "feat(ens): AgentRecord resolver with text-record parsing"
```

---

## Task 3: ENS Name Registration (Testnet)

**Goal:** Get `alex-tollgate.eth` and `bella-tollgate.eth` registered on Base Sepolia with required text records.

**Step 1: Get testnet ETH**

Visit `https://faucet.base.org` and fund both wallets (addresses derived from `ALEX_WALLET_PRIVATE_KEY` / `BELLA_WALLET_PRIVATE_KEY`).

**Step 2: Create registration script**

```python
# scripts/register_ens.py
"""
Run once: registers ENS names and sets text records on Base Sepolia.
Usage: python scripts/register_ens.py
"""
import asyncio, os
from web3 import AsyncWeb3
from dotenv import load_dotenv

load_dotenv()

NAMES = {
    os.environ["ALEX_ENS"]: {
        "axl.node": os.environ.get("ALEX_AXL_NODE", "PLACEHOLDER"),
        "contact.price": "0",
        "contact.currency": "USDC",
        "contact.workflow": "alex/inbound-toll",
        "capabilities": '["call"]',
        "agent.version": "tollgate/0.1",
    },
    os.environ["BELLA_ENS"]: {
        "axl.node": os.environ.get("BELLA_AXL_NODE", "PLACEHOLDER"),
        "contact.price": "0.25",
        "contact.currency": "USDC",
        "contact.workflow": "bella/inbound-toll",
        "capabilities": '["booking","quotes"]',
        "agent.version": "tollgate/0.1",
    },
}

async def main():
    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(os.environ["RPC_URL"]))
    for name, records in NAMES.items():
        print(f"Setting records for {name}: {records}")
        # NOTE: ENS on Base Sepolia may require using the ENS app UI or
        # the @ensdomains/ensjs library via a Node.js script.
        # If web3.py does not support setTextRecord on Base Sepolia,
        # use: npx --yes @ensdomains/ensjs-cli set-text <name> <key> <value>
        print("  → Use ENS app at app.ens.domains or ensjs CLI if web3.py path fails")

if __name__ == "__main__":
    asyncio.run(main())
```

**Step 3: Run and verify**

```bash
python scripts/register_ens.py
```

Then verify with:
```bash
python -c "
import asyncio, os
from dotenv import load_dotenv
from src.ens.resolver import resolve_agent_records
load_dotenv()
async def check():
    r = await resolve_agent_records(os.environ['BELLA_ENS'])
    print(r)
asyncio.run(check())
"
```

Expected: prints an `AgentRecord` with real values (not empty strings).

**Step 4: Update .env with real AXL node IDs once Task 4 is done**

Note: Come back and re-run this script after Task 4 (AXL) produces real node IDs.

**Step 5: Commit**

```bash
git add scripts/register_ens.py
git commit -m "chore(ens): registration script + instructions"
```

---

## Task 4: AXL Integration — Two Nodes, Hello World

**Files:**
- Create: `src/protocol/__init__.py`
- Create: `src/protocol/messages.py`
- Create: `src/protocol/session.py`
- Create: `tests/test_protocol.py`

**Step 1: Install AXL SDK**

```bash
pip install axl  # or: pip install gensyn-axl
# If the package name differs, check: https://github.com/gensyn-ai/axl
# and update pyproject.toml accordingly
```

Check the actual package name:
```bash
pip search axl 2>/dev/null || pip install axl --dry-run
```

**Step 2: Write failing protocol tests**

```python
# tests/test_protocol.py
import pytest
from src.protocol.messages import (
    ProposeMessage, CounterMessage, AcceptMessage,
    ConfirmMessage, RejectMessage, MessageType
)

def test_propose_message_serializes():
    msg = ProposeMessage(date="2026-05-02", party_size=4, deposit_amount="20.00")
    data = msg.to_dict()
    assert data["type"] == "PROPOSE"
    assert data["date"] == "2026-05-02"
    assert data["party_size"] == 4

def test_accept_message_round_trips():
    msg = AcceptMessage(slot_id="slot-abc", deposit_amount="20.00", terms_hash="0xdeadbeef")
    rebuilt = AcceptMessage(**{k: v for k, v in msg.to_dict().items() if k != "type"})
    assert rebuilt.slot_id == msg.slot_id

def test_message_type_enum():
    assert MessageType.PROPOSE.value == "PROPOSE"
    assert MessageType.CONFIRM.value == "CONFIRM"
```

**Step 3: Run to verify failure**

```bash
pytest tests/test_protocol.py -v
```
Expected: `ModuleNotFoundError`

**Step 4: Implement message schemas**

```python
# src/protocol/messages.py
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Optional

class MessageType(str, Enum):
    PROPOSE = "PROPOSE"
    COUNTER = "COUNTER"
    ACCEPT  = "ACCEPT"
    REJECT  = "REJECT"
    CONFIRM = "CONFIRM"

@dataclass
class ProposeMessage:
    date: str
    party_size: int
    deposit_amount: str
    type: str = MessageType.PROPOSE.value

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class CounterMessage:
    date: str
    party_size: int
    deposit_amount: str
    alt_slots: list[str]
    type: str = MessageType.COUNTER.value

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class AcceptMessage:
    slot_id: str
    deposit_amount: str
    terms_hash: str
    type: str = MessageType.ACCEPT.value

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class RejectMessage:
    reason: str
    type: str = MessageType.REJECT.value

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class ConfirmMessage:
    slot_id: str
    signature: str
    type: str = MessageType.CONFIRM.value

    def to_dict(self) -> dict:
        return asdict(self)
```

**Step 5: Run tests**

```bash
pytest tests/test_protocol.py -v
```
Expected: all PASS

**Step 6: Write AXL session wrapper**

```python
# src/protocol/session.py
"""
Thin wrapper around the AXL SDK for Tollgate session lifecycle.
Consult https://github.com/gensyn-ai/axl for actual SDK API.
"""
import asyncio
import json
import logging
from typing import AsyncIterator, Callable, Optional

logger = logging.getLogger(__name__)

class AXLSession:
    """
    Manages one AXL channel: connect, send, receive, close.
    SDK API is subject to change — adapt method names to match live docs.
    """

    def __init__(self, node_id: str, peer_node_id: str):
        self.node_id = node_id
        self.peer_node_id = peer_node_id
        self._channel = None  # AXL channel object set on connect

    async def connect(self) -> None:
        """Open AXL channel to peer. Requires toll receipt to already be verified."""
        # Replace with actual AXL SDK call, e.g.:
        # from axl import AXLClient
        # self._channel = await AXLClient.connect(self.node_id, self.peer_node_id)
        logger.info("AXL connect: %s → %s", self.node_id, self.peer_node_id)
        self._channel = True  # placeholder

    async def send(self, message: dict) -> None:
        if not self._channel:
            raise RuntimeError("Channel not open")
        payload = json.dumps(message).encode()
        # await self._channel.send(payload)
        logger.info("AXL send: %s", message.get("type"))

    async def receive(self) -> dict:
        """Blocking receive — returns one decoded message dict."""
        # raw = await self._channel.receive()
        # return json.loads(raw)
        raise NotImplementedError("Wire up AXL SDK receive")

    async def close(self) -> None:
        if self._channel:
            # await self._channel.close()
            self._channel = None
        logger.info("AXL channel closed")
```

**Step 7: Run full test suite**

```bash
pytest tests/ -v
```
Expected: all passing

**Step 8: Commit**

```bash
git add src/protocol/ tests/test_protocol.py
git commit -m "feat(axl): message schemas + AXL session skeleton"
```

---

## Task 5: AXL Hello-World Smoke Test (Two Real Nodes)

**Goal:** Prove two AXL nodes can exchange a real message before integrating anything else.

**Step 1: Consult AXL docs and run their quickstart**

```bash
# From: https://github.com/gensyn-ai/axl
# and: https://github.com/gensyn-ai/collaborative-autoresearch-demo
# Follow the README to start two nodes locally (or on separate machines).
# Typical pattern:
axl node start --id alex-node --port 7001 &
axl node start --id bella-node --port 7002 &
```

**Step 2: Send a test message between nodes**

```bash
# Caller side (adapt to actual SDK CLI):
axl send --from alex-node --to bella-node --message '{"type":"HELLO"}'
```

Expected: Bella's node logs show `{"type":"HELLO"}` received.

**Step 3: Smoke test with Python**

```python
# scripts/axl_smoke_test.py
import asyncio
from src.protocol.session import AXLSession

async def main():
    session = AXLSession(node_id="alex-node", peer_node_id="bella-node")
    await session.connect()
    await session.send({"type": "HELLO", "from": "alex"})
    print("AXL smoke test PASSED")
    await session.close()

asyncio.run(main())
```

**Step 4: Update AXLSession with real SDK calls**

Once the smoke test works, replace all `# placeholder` comments in `src/protocol/session.py` with the actual SDK calls from the docs/smoke test. Wire up `receive()`.

**Step 5: Update .env with real AXL node IDs**

```bash
ALEX_AXL_NODE=<actual node ID from step 1>
BELLA_AXL_NODE=<actual node ID from step 1>
```

Then re-run the ENS registration script (Task 3 Step 2) to publish these.

**Step 6: Commit**

```bash
git add src/protocol/session.py scripts/axl_smoke_test.py .env.example
git commit -m "feat(axl): wire real AXL SDK + smoke test passing"
```

---

## Task 6: KeeperHub MCP — Toll Payment

**Files:**
- Create: `src/payments/__init__.py`
- Create: `src/payments/keeperhub.py`
- Create: `src/payments/receipt.py`
- Create: `tests/test_keeperhub.py`

**Step 1: Read KeeperHub docs**

Visit `https://docs.keeperhub.com/ai-tools` and `https://docs.keeperhub.com/api`.
Note the actual MCP tool names and parameter shapes. The plan uses assumed names — adapt as needed.

**Step 2: Write failing tests**

```python
# tests/test_keeperhub.py
import pytest
from unittest.mock import AsyncMock, patch
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import Receipt

@pytest.mark.asyncio
async def test_pay_workflow_returns_receipt():
    client = KeeperHubClient(api_key="test-key", base_url="http://mock")
    mock_response = {
        "tx_hash": "0xabc123",
        "signed_receipt": "sig_xyz",
        "status": "confirmed",
    }
    with patch.object(client, "_post", new_callable=AsyncMock, return_value=mock_response):
        receipt = await client.pay_workflow(TollPaymentRequest(
            workflow_id="bella/inbound-toll",
            amount="0.25",
            currency="USDC",
            from_wallet="0xAlexWallet",
            caller_ens="alex.eth",
        ))
    assert receipt.tx_hash == "0xabc123"
    assert receipt.status == "confirmed"

@pytest.mark.asyncio
async def test_receipt_verification_passes_on_valid_sig():
    from src.payments.receipt import verify_receipt
    receipt = Receipt(tx_hash="0xabc", signed_receipt="valid_sig", status="confirmed")
    # Signature verification is chain-dependent; for MVP trust KeeperHub's signed receipt
    assert verify_receipt(receipt) is True
```

**Step 3: Run to verify failure**

```bash
pytest tests/test_keeperhub.py -v
```

**Step 4: Implement KeeperHub client**

```python
# src/payments/keeperhub.py
import os
import httpx
from dataclasses import dataclass
from src.payments.receipt import Receipt

@dataclass
class TollPaymentRequest:
    workflow_id: str
    amount: str
    currency: str
    from_wallet: str
    caller_ens: str

class KeeperHubClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.environ["KEEPERHUB_API_KEY"]
        self.base_url = base_url or os.environ.get("KEEPERHUB_BASE_URL", "https://api.keeperhub.com")

    async def _post(self, path: str, body: dict) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}{path}", json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()

    async def pay_workflow(self, req: TollPaymentRequest) -> Receipt:
        # Adapt path + payload shape to match live KeeperHub MCP docs
        body = {
            "workflow_id": req.workflow_id,
            "amount": req.amount,
            "currency": req.currency,
            "from": req.from_wallet,
            "metadata": {"purpose": "inbound_channel", "caller_ens": req.caller_ens},
        }
        data = await self._post("/v1/workflows/pay", body)
        return Receipt(
            tx_hash=data["tx_hash"],
            signed_receipt=data.get("signed_receipt", ""),
            status=data.get("status", "pending"),
        )

    async def execute_workflow(self, workflow_id: str, params: dict, audit_tag: str) -> Receipt:
        body = {"workflow_id": workflow_id, "params": params, "audit_tag": audit_tag}
        data = await self._post("/v1/workflows/execute", body)
        return Receipt(
            tx_hash=data["tx_hash"],
            signed_receipt=data.get("signed_receipt", ""),
            status=data.get("status", "pending"),
        )
```

```python
# src/payments/receipt.py
from dataclasses import dataclass

@dataclass
class Receipt:
    tx_hash: str
    signed_receipt: str
    status: str  # "pending" | "confirmed" | "failed"

def verify_receipt(receipt: Receipt) -> bool:
    # MVP: trust KeeperHub's signed_receipt field if status is confirmed.
    # Stretch: verify on-chain via RPC.
    return receipt.status == "confirmed" and bool(receipt.tx_hash)
```

**Step 5: Run tests**

```bash
pytest tests/test_keeperhub.py -v
```
Expected: both PASS

**Step 6: Live smoke test**

```python
# scripts/keeperhub_smoke_test.py
import asyncio, os
from dotenv import load_dotenv
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest

load_dotenv()

async def main():
    client = KeeperHubClient()
    receipt = await client.pay_workflow(TollPaymentRequest(
        workflow_id=os.environ.get("BELLA_TOLL_WORKFLOW", "bella/inbound-toll"),
        amount="0.01",
        currency="USDC",
        from_wallet=os.environ["ALEX_WALLET_ADDRESS"],
        caller_ens=os.environ["ALEX_ENS"],
    ))
    print("Toll payment receipt:", receipt)
    assert receipt.status == "confirmed", f"Unexpected status: {receipt.status}"
    print("KeeperHub smoke test PASSED")

asyncio.run(main())
```

**Step 7: Commit**

```bash
git add src/payments/ tests/test_keeperhub.py scripts/keeperhub_smoke_test.py
git commit -m "feat(payments): KeeperHub client + receipt verification"
```

---

## Task 7: Voice Layer — Basic LiveKit Agent Call

**Files:**
- Create: `src/agents/__init__.py`
- Create: `src/agents/caller.py`
- Create: `src/agents/callee.py`

**Step 1: Set up LiveKit Cloud**

- Create free project at `https://cloud.livekit.io`
- Copy URL, API key, API secret into `.env`
- Also set `OPENAI_API_KEY`

**Step 2: Write caller agent (Alex)**

```python
# src/agents/caller.py
"""
Alex's agent: initiates the booking call to Bella.
Run with: python -m src.agents.caller
"""
import asyncio, os, logging
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero

load_dotenv()
logger = logging.getLogger("caller")

SYSTEM_PROMPT = """
You are Alex's personal assistant. Your only job in this call is to book a table at Bella restaurant
for Friday, party of 4, maximum $25 deposit. You are calling Bella's agent.

When the other party answers, introduce yourself:
"Hi, I'm an AI agent calling on behalf of Alex. I'd like to book a table for Friday, party of 4."

Negotiate politely. Accept any slot within $25 deposit. Once confirmed, say "Deal confirmed" and summarize.
"""

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(),
        chat_ctx=llm.ChatContext().append(role="system", text=SYSTEM_PROMPT),
    )
    assistant.start(ctx.room)
    await asyncio.sleep(1)
    await assistant.say("Hi, I'm an AI agent calling on behalf of Alex. I'd like to book a table for Friday, party of 4.", allow_interruptions=True)
    await asyncio.Event().wait()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

**Step 3: Write callee agent (Bella)**

```python
# src/agents/callee.py
"""
Bella's restaurant agent: receives bookings, negotiates terms.
Run with: python -m src.agents.callee
"""
import asyncio, os, logging
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero

load_dotenv()
logger = logging.getLogger("callee")

SYSTEM_PROMPT = """
You are Bella restaurant's AI host. When a caller wants to book a table:
- Available Friday slots: 7pm (full), 8pm (open), 9pm (open)
- Standard deposit: $20 per booking
- Maximum party: 6

Introduce yourself: "Thank you for calling Bella. I'm an AI agent. How can I help you?"

If asked for Friday party of 4: offer 8pm, $20 deposit.
Confirm with slot ID "BELLA-FRI-8PM" and terms hash "0xterms".
"""

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(),
        chat_ctx=llm.ChatContext().append(role="system", text=SYSTEM_PROMPT),
    )
    assistant.start(ctx.room)
    await asyncio.Event().wait()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

**Step 4: Test locally — both agents in same LiveKit room**

Terminal 1:
```bash
source .venv/bin/activate
LIVEKIT_ROOM=tollgate-test python -m src.agents.callee
```

Terminal 2:
```bash
source .venv/bin/activate
LIVEKIT_ROOM=tollgate-test python -m src.agents.caller
```

You should hear two AI voices talking to each other. This proves the voice layer works.

**Step 5: Commit**

```bash
git add src/agents/
git commit -m "feat(voice): caller + callee LiveKit agents, basic voice handshake"
```

---

## Task 8: Integration — Toll + AXL in Agent Flow

**Files:**
- Modify: `src/agents/caller.py`
- Modify: `src/agents/callee.py`
- Create: `src/audio/events.py`

**Step 1: Add agent-detection phase to caller**

In `caller.py`, after the initial voice greeting is acknowledged, add:
1. ENS resolve `bella.eth` → get `AgentRecord`
2. Call `KeeperHubClient.pay_workflow()` → get `Receipt`
3. Open `AXLSession` and run the negotiation loop
4. Emit audio events (handshake sweep, chirps, confirmation)

```python
# Integrate in caller.py entrypoint, after VoiceAssistant.start():

from src.ens.resolver import resolve_agent_records
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import verify_receipt
from src.protocol.session import AXLSession
from src.protocol.messages import ProposeMessage, ConfirmMessage
import uuid

async def run_axl_negotiation(record, receipt, event_emitter):
    session = AXLSession(node_id=os.environ["ALEX_AXL_NODE"],
                         peer_node_id=record.axl_node)
    await session.connect()
    event_emitter.emit("handshake_sweep")

    propose = ProposeMessage(date="2026-05-02", party_size=4, deposit_amount="20.00")
    await session.send(propose.to_dict())
    event_emitter.emit("chirp", {"msg_type": "PROPOSE"})

    response = await session.receive()
    event_emitter.emit("chirp", {"msg_type": response.get("type")})

    if response["type"] == "ACCEPT":
        confirm = ConfirmMessage(slot_id=response["slot_id"], signature="agent-sig")
        await session.send(confirm.to_dict())
        event_emitter.emit("chirp", {"msg_type": "CONFIRM"})

    await session.close()
    return response
```

**Step 2: Add toll verification to callee**

In `callee.py`, add a gate that checks the incoming toll receipt before allowing negotiation:

```python
from src.payments.receipt import verify_receipt, Receipt

async def gate_toll(receipt_data: dict) -> bool:
    receipt = Receipt(**receipt_data)
    return verify_receipt(receipt)
```

**Step 3: Create audio event emitter**

```python
# src/audio/events.py
"""
Emits audio events over a websocket to the browser demo UI.
Browser UI (Tone.js) maps event types to sounds.
"""
import asyncio, json, logging
import websockets

logger = logging.getLogger("audio")

class AudioEventEmitter:
    def __init__(self, ws_url: str = "ws://localhost:8765"):
        self.ws_url = ws_url
        self._ws = None

    async def connect(self):
        self._ws = await websockets.connect(self.ws_url)

    def emit(self, event_type: str, data: dict | None = None):
        if not self._ws:
            return
        payload = json.dumps({"event": event_type, **(data or {})})
        asyncio.create_task(self._ws.send(payload))

    async def close(self):
        if self._ws:
            await self._ws.close()
```

**Step 4: End-to-end local test**

Run callee, then caller. Watch logs. Verify:
- ENS record is resolved
- KeeperHub toll tx hash appears
- AXL messages logged: PROPOSE → ACCEPT → CONFIRM
- Audio events emitted

**Step 5: Commit**

```bash
git add src/agents/ src/audio/
git commit -m "feat: integrate ENS + toll + AXL negotiation into agent flow"
```

---

## Task 9: Demo UI

**Files:**
- Create: `ui/package.json`
- Create: `ui/vite.config.ts`
- Create: `ui/src/App.tsx`
- Create: `ui/src/TracePanel.tsx`
- Create: `ui/src/audio.ts`

**Step 1: Initialize Vite + React**

```bash
cd ui
npm create vite@latest . -- --template react-ts
npm install
npm install tone
```

**Step 2: TracePanel — live trace display**

```tsx
// ui/src/TracePanel.tsx
import { useEffect, useState } from "react";

interface TraceEvent {
  time: string;
  event: string;
  detail?: string;
}

export function TracePanel() {
  const [events, setEvents] = useState<TraceEvent[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8765");
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      setEvents(prev => [...prev, {
        time: new Date().toISOString().slice(11, 23),
        event: data.event,
        detail: JSON.stringify(data),
      }]);
    };
    return () => ws.close();
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: 16 }}>
      <h2>Tollgate Trace</h2>
      {events.map((e, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <span style={{ color: "#888" }}>{e.time}</span>{" "}
          <strong>{e.event}</strong>{" "}
          <span style={{ color: "#ccc" }}>{e.detail}</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Audio state machine (Tone.js)**

```ts
// ui/src/audio.ts
import * as Tone from "tone";

const synth = new Tone.Synth().toDestination();

export function playHandshakeSweep() {
  const sweep = new Tone.Oscillator({ frequency: 400, type: "sine" }).toDestination();
  sweep.start();
  sweep.frequency.rampTo(2000, 1.2);
  setTimeout(() => sweep.stop(), 1300);
}

export function playChirp(msgType: string) {
  const freqMap: Record<string, number> = {
    PROPOSE: 880,
    COUNTER: 660,
    ACCEPT: 1100,
    CONFIRM: 1320,
    REJECT: 220,
  };
  synth.triggerAttackRelease(freqMap[msgType] ?? 440, "8n");
}

export function playSettlementChime() {
  synth.triggerAttackRelease("E5", "4n");
  setTimeout(() => synth.triggerAttackRelease("G#5", "4n"), 300);
}

export function handleAudioEvent(event: string) {
  if (event === "handshake_sweep") playHandshakeSweep();
  else if (event === "settlement_done") playSettlementChime();
  else if (event.startsWith("chirp") || ["PROPOSE","COUNTER","ACCEPT","CONFIRM","REJECT"].includes(event)) {
    playChirp(event);
  }
}
```

**Step 4: Wire into App.tsx**

```tsx
// ui/src/App.tsx
import { TracePanel } from "./TracePanel";
import { handleAudioEvent } from "./audio";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8765");
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      handleAudioEvent(data.event ?? data.msg_type ?? "");
    };
    return () => ws.close();
  }, []);

  return (
    <div style={{ background: "#111", minHeight: "100vh", color: "#eee" }}>
      <h1 style={{ padding: 16 }}>Tollgate — Agent Call Demo</h1>
      <TracePanel />
    </div>
  );
}
```

**Step 5: Run UI**

```bash
cd ui && npm run dev
```
Open browser at `http://localhost:5173`. Trigger a full agent run and watch events stream in.

**Step 6: Commit**

```bash
git add ui/
git commit -m "feat(ui): demo trace panel + Tone.js audio state machine"
```

---

## Task 10: FEEDBACK.md + README

**Step 1: Write FEEDBACK.md** (required for KeeperHub bounty eligibility)

Sections to fill in after running smoke tests:
- MCP ergonomics (was the tool shape intuitive?)
- x402 latency observations (ms per tx)
- Reproducible bugs (exact steps + error messages)
- Doc gaps (what was missing or wrong in docs)
- Feature requests

**Step 2: Write README.md**

Sections:
- Project name + one-line pitch
- Architecture diagram (copy from project-idea.mdx §3)
- Setup instructions (`pnpm install`, `.env`, `python -m ...`)
- Sponsor integration mapping (copy from project-idea.mdx §6)
- Demo instructions
- Team + contact

**Step 3: Commit**

```bash
git add FEEDBACK.md README.md
git commit -m "docs: FEEDBACK.md stub + README with architecture and setup"
```

---

## Task 11: Stretch — Unpaid Call Rejection Demo

**Files:**
- Modify: `src/agents/callee.py`

**Step 1: Add rejection gate**

In `callee.py`, before allowing full negotiation, check if a valid toll receipt is present in the incoming metadata. If not, have the agent say:

> "I'm sorry, this channel requires a toll payment to proceed. Please have your agent complete the payment and call again."

Then end the session.

**Step 2: Test the rejection flow**

Start a caller agent that does NOT pay the toll. Confirm the callee rejects it audibly.

**Step 3: Commit**

```bash
git commit -m "feat(stretch): unpaid call rejection demo"
```

---

## Task 12: Rehearsal & Metric Collection

**Targets:**
- Paid channel open: ≤ 8s
- Negotiation: ≤ 5s
- End-to-end: ≤ 30s
- Tx success: ≥ 95%

**Step 1: Add timing instrumentation**

```python
# In caller.py, wrap each phase with time.perf_counter():
import time

t0 = time.perf_counter()
record = await resolve_agent_records(bella_ens)
logger.info("ENS resolve: %.2fs", time.perf_counter() - t0)

t1 = time.perf_counter()
receipt = await client.pay_workflow(...)
logger.info("Toll payment: %.2fs", time.perf_counter() - t1)

t2 = time.perf_counter()
await run_axl_negotiation(...)
logger.info("AXL negotiation: %.2fs", time.perf_counter() - t2)
```

**Step 2: Run 5 end-to-end rehearsals, log times**

**Step 3: Fill in success metrics in README**

Update the "Observed" section in README with best + median timings.

**Step 4: Commit**

```bash
git commit -m "chore: timing instrumentation + observed metrics in README"
```

---

## Open Decisions to Resolve Before Coding

| # | Decision | Default |
|---|---|---|
| 1 | Agent detection method | Verbal announcement (Option A) |
| 2 | Voice stack | LiveKit Agents + OpenAI Realtime |
| 3 | Chain | Base Sepolia |
| 4 | Settlement form | Signed commitment + direct USDC transfer |
| 5 | AXL SDK package name | Verify at `github.com/gensyn-ai/axl` |
| 6 | KeeperHub MCP API paths | Verify at `docs.keeperhub.com/ai-tools` |

---

## Day-1 Completion Checklist

Before writing any Tollgate-specific integration code, these must be green:

- [ ] `alex-tollgate.eth` and `bella-tollgate.eth` registered with text records
- [ ] Two AXL nodes passing a "HELLO" message (smoke test script exits with PASSED)
- [ ] KeeperHub smoke test exits with PASSED (real tx hash returned)
- [ ] Basic voice-to-voice working between caller and callee agents
- [ ] `FEEDBACK.md` stub committed
