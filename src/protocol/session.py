# src/protocol/session.py
"""
AXL session wrapper for Tollgate.

AXL (Agent eXchange Layer) by Gensyn is a Go binary that exposes a local HTTP
bridge API. There is no Python SDK package — integration is via HTTP.

HTTP bridge API (default port 9002):
  GET  /topology  → {"our_public_key": "<64-char hex>", ...}
  POST /send      → fires payload to peer
                    Header: X-Destination-Peer-Id: <64-char hex pubkey>
  GET  /recv      → 200 + payload if message waiting, 204 if empty

Constructor args:
  bridge_url   — HTTP bridge URL of OUR node, e.g. "http://127.0.0.1:9002"
  peer_peer_id — 64-char hex ed25519 public key of the PEER node
                 (discovered via GET /topology on their bridge)

Nodes must be running before connect() is called.
See scripts/axl_smoke_test.py for startup instructions.
"""
import asyncio
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_RECV_POLL_INTERVAL = 0.3  # seconds between /recv polls


class AXLSession:
    def __init__(self, bridge_url: str, peer_peer_id: str):
        self.bridge_url = bridge_url.rstrip("/")
        self.peer_peer_id = peer_peer_id
        self._channel = None  # set to aiohttp.ClientSession on connect()

    async def connect(self) -> None:
        try:
            import aiohttp
        except ImportError:
            raise RuntimeError("aiohttp required for AXL: pip install aiohttp")

        import aiohttp as _aiohttp
        session = _aiohttp.ClientSession()
        # Verify our bridge is reachable
        try:
            async with session.get(f"{self.bridge_url}/topology", timeout=_aiohttp.ClientTimeout(total=5)) as resp:
                resp.raise_for_status()
                topo = await resp.json()
                our_key = topo.get("our_public_key", "?")
                logger.info("AXL connected: our_key=%s peer=%s", our_key[:12], self.peer_peer_id[:12])
        except Exception as exc:
            await session.close()
            raise RuntimeError(f"AXL bridge unreachable at {self.bridge_url}: {exc}") from exc

        self._channel = session

    async def send(self, message: dict) -> None:
        if not self._channel:
            raise RuntimeError("AXL channel not open — call connect() first")
        import aiohttp
        payload = json.dumps(message).encode()
        async with self._channel.post(
            f"{self.bridge_url}/send",
            data=payload,
            headers={"X-Destination-Peer-Id": self.peer_peer_id},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            resp.raise_for_status()
        logger.info("AXL send: type=%s", message.get("type"))

    async def receive(self, timeout: float = 30.0) -> dict:
        if not self._channel:
            raise RuntimeError("AXL channel not open — call connect() first")
        import aiohttp
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            async with self._channel.get(
                f"{self.bridge_url}/recv",
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status == 200:
                    raw = await resp.read()
                    return json.loads(raw)
                elif resp.status == 204:
                    await asyncio.sleep(_RECV_POLL_INTERVAL)
                else:
                    resp.raise_for_status()
        raise TimeoutError(f"AXL receive timed out after {timeout}s")

    async def close(self) -> None:
        if self._channel:
            await self._channel.close()
            self._channel = None
        logger.info("AXL channel closed")

    async def __aenter__(self) -> "AXLSession":
        await self.connect()
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()
