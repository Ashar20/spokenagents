"""Replay a fake negotiation trace into the trace WS server.

Useful for testing the pixel-office canvas animation without spawning Alex
or hitting Daily.

Usage:
    .venv/bin/python scripts/replay_trace.py
"""
import asyncio
import json
import sys

import websockets

WS_URL = "ws://localhost:8765"

SEQUENCE = [
    ("ens_resolving", {"name": "bella.spokenagents.eth"}, 0.4),
    ("ens_resolved", {"node": "0xabc...", "wallet": "0xbella"}, 0.6),
    ("toll_paying", {"workflow_id": "wf_1", "amount": "0.05"}, 0.6),
    ("toll_paid", {"tx_hash": "0xdeadbeef", "status": "confirmed"}, 0.8),
    ("handshake_sweep", {}, 0.6),
    ("chirp", {"msg_type": "PROPOSE"}, 0.5),
    ("chirp", {"msg_type": "COUNTER"}, 0.5),
    ("chirp", {"msg_type": "ACCEPT"}, 0.5),
    ("chirp", {"msg_type": "CONFIRM"}, 0.5),
    ("settlement_executing", {"slot_id": "slot_42", "deposit": "20"}, 0.7),
    ("settlement_done", {"tx_hash": "0xfeedface"}, 0.0),
]


async def main() -> None:
    print(f"connecting to {WS_URL} ...", flush=True)
    async with websockets.connect(WS_URL) as ws:
        for event, data, delay in SEQUENCE:
            payload = json.dumps({"event": event, **data})
            await ws.send(payload)
            print(f"  -> {event} {data}", flush=True)
            await asyncio.sleep(delay)
    print("done", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ConnectionRefusedError:
        print("ERROR: WS server not running. Start the backend first:", file=sys.stderr)
        print("  .venv/bin/python -m uvicorn src.server:app --port 8080", file=sys.stderr)
        sys.exit(1)
