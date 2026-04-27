#!/usr/bin/env python3
"""
AXL smoke test for Tollgate.

Gensyn's AXL (Agent eXchange Layer) is a Go binary that exposes a local HTTP
bridge API.  There is NO Python SDK package on PyPI — the correct integration
path is via HTTP calls to the running node on 127.0.0.1:9002 (default port).

AXL source & docs: https://github.com/gensyn-ai/axl

This script has two modes:
  1. Stub mode (default): exercises the AXLSession placeholder, proves the
     interface works without any external dependencies.
  2. Real mode (--real): exercises two live AXL nodes via their HTTP API.
     Requires nodes built from source and running locally.

Usage:
  python scripts/axl_smoke_test.py          # stub mode (always works)
  python scripts/axl_smoke_test.py --real   # real AXL nodes required
"""
import asyncio
import json
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("axl_smoke")

# ---------------------------------------------------------------------------
# AXL SDK / package notes
# ---------------------------------------------------------------------------
# There is NO installable Python SDK for Gensyn AXL on PyPI.
#
# The package "axl" (v0.5.1) on PyPI is an unrelated scipy/numpy wrapper —
# it is NOT Gensyn's AXL.
# The package "gensyn-axl" does NOT exist on PyPI.
#
# Real AXL integration is done via HTTP to the running Go node:
#
#   Node binary: built with `make build` from github.com/gensyn-ai/axl
#   Default HTTP bridge: http://127.0.0.1:9002
#
#   Key endpoints:
#     GET  /topology  — returns our IPv6 address + public key (peer ID)
#     POST /send      — fire-and-forget to peer
#                       Header: X-Destination-Peer-Id: <64-char hex pubkey>
#                       Body:   raw binary payload
#     GET  /recv      — poll for inbound messages
#                       200 OK  → body=payload, header X-From-Peer-Id
#                       204     → queue empty
#
# ---------------------------------------------------------------------------


def check_axl_sdk() -> bool:
    """
    Gensyn AXL has no Python SDK — returns False always.

    The correct check is whether the AXL node HTTP bridge is reachable
    (done in smoke_test_real via /topology).
    """
    logger.info(
        "AXL SDK: no Python package exists — AXL is a Go binary with HTTP API. "
        "Running in stub mode."
    )
    return False


async def smoke_test_stub() -> None:
    """Exercises the AXLSession placeholder interface without real AXL nodes."""
    from src.protocol.session import AXLSession
    from src.protocol.messages import ProposeMessage

    logger.info("=== AXL Stub Smoke Test ===")

    async with AXLSession(node_id="alex-node", peer_node_id="bella-node") as session:
        assert session._channel is not None, "connect() should set _channel"
        logger.info("connect() works")

        msg = ProposeMessage(date="2026-05-02", party_size=4, deposit_amount="20.00")
        await session.send(msg.to_dict())
        logger.info("send() works (stub — no real transmission)")

        try:
            await session.receive()
        except NotImplementedError:
            logger.info(
                "receive() raises NotImplementedError as expected (stub)"
            )

    assert session._channel is None, "close() should clear _channel"
    logger.info("close() via context manager works")
    logger.info("=== Stub smoke test PASSED ===")


async def smoke_test_real() -> None:
    """
    Exercises two real AXL nodes via their HTTP bridge API.

    PREREQUISITES before running --real:

      1. Build the AXL node binary (requires Go 1.25.5+):
           git clone https://github.com/gensyn-ai/axl
           cd axl
           make build

      2. Generate ed25519 keys for each node:
           openssl genpkey -algorithm ed25519 -out alex-private.pem
           openssl genpkey -algorithm ed25519 -out bella-private.pem

      3. Create node configs (node-config-alex.json):
           {
             "PrivateKeyPath": "alex-private.pem",
             "Peers": [],
             "Listen": ["tls://0.0.0.0:9001"]
           }
         And (node-config-bella.json) peering to alex:
           {
             "PrivateKeyPath": "bella-private.pem",
             "Peers": ["tls://127.0.0.1:9001"],
             "Listen": []
           }

      4. Start each node (in separate terminals):
           Terminal 1: ./node -config node-config-alex.json  (HTTP API on :9002)
           Terminal 2: ./node -config node-config-bella.json -api-port 9012
         (adapt --api-port / bridge_addr in config if needed)

      5. Set env vars — get peer IDs from GET /topology on each node:
           export ALEX_AXL_NODE=http://127.0.0.1:9002    # alex's HTTP bridge
           export BELLA_AXL_NODE=http://127.0.0.1:9012   # bella's HTTP bridge
           export BELLA_PEER_ID=<64-char hex public key from bella's /topology>

      6. Wire up AXLSession.connect/send/receive/close in src/protocol/session.py
         replacing the # TASK 5 placeholder comments with real HTTP calls
         (see _real_connect / _real_send / _real_receive helpers below as a guide).
    """
    import os
    try:
        import aiohttp
    except ImportError:
        logger.error(
            "--real mode requires aiohttp: pip install aiohttp"
        )
        sys.exit(1)

    from dotenv import load_dotenv
    load_dotenv()

    alex_bridge = os.environ.get("ALEX_AXL_NODE", "http://127.0.0.1:9002")
    bella_bridge = os.environ.get("BELLA_AXL_NODE", "http://127.0.0.1:9012")
    bella_peer_id = os.environ.get("BELLA_PEER_ID", "")

    if not bella_peer_id:
        # Discover bella's peer ID from her /topology endpoint
        logger.info("BELLA_PEER_ID not set — fetching from %s/topology", bella_bridge)
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{bella_bridge}/topology", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                topo = await resp.json()
                bella_peer_id = topo.get("our_public_key", "")
                logger.info("Bella peer ID: %s", bella_peer_id)

    if not bella_peer_id:
        logger.error("Could not determine bella's peer ID — is the bella node running?")
        sys.exit(1)

    from src.protocol.messages import ProposeMessage

    logger.info("=== AXL Real Smoke Test ===")
    logger.info("Alex bridge: %s", alex_bridge)
    logger.info("Bella bridge: %s", bella_bridge)
    logger.info("Bella peer ID: %s", bella_peer_id)

    propose = ProposeMessage(date="2026-05-02", party_size=4, deposit_amount="20.00")
    payload = json.dumps(propose.to_dict()).encode()

    async with aiohttp.ClientSession() as s:
        # Send PROPOSE from alex's node to bella
        async with s.post(
            f"{alex_bridge}/send",
            data=payload,
            headers={"X-Destination-Peer-Id": bella_peer_id},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            resp.raise_for_status()
            sent_bytes = resp.headers.get("X-Sent-Bytes", "?")
            logger.info("Sent PROPOSE (%s bytes)", sent_bytes)

        # Poll bella for the inbound message
        logger.info("Polling bella for inbound message...")
        for attempt in range(10):
            async with s.get(
                f"{bella_bridge}/recv",
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status == 200:
                    raw = await resp.read()
                    from_peer = resp.headers.get("X-From-Peer-Id", "unknown")
                    received = json.loads(raw)
                    logger.info("Bella received from %s: %s", from_peer, received)
                    assert received.get("type") == "PROPOSE", \
                        f"Expected PROPOSE, got: {received.get('type')}"
                    logger.info("=== Real smoke test PASSED ===")
                    return
                elif resp.status == 204:
                    logger.info("  attempt %d/10: queue empty, retrying...", attempt + 1)
                    await asyncio.sleep(0.5)
                else:
                    resp.raise_for_status()

    logger.error("Did not receive message after 10 attempts")
    sys.exit(1)


async def main() -> None:
    real_mode = "--real" in sys.argv
    check_axl_sdk()  # always log SDK status

    if real_mode:
        await smoke_test_real()
    else:
        await smoke_test_stub()


if __name__ == "__main__":
    asyncio.run(main())
