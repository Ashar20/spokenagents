# src/protocol/session.py
"""
AXL session wrapper for Tollgate.

This is a skeleton. The `_channel` object and actual send/receive calls
are placeholders that will be replaced with real AXL SDK calls in Task 5
once the SDK package name and API are confirmed from:
  https://github.com/gensyn-ai/axl
  https://docs.gensyn.ai/tech/agent-exchange-layer
"""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class AXLSession:
    def __init__(self, node_id: str, peer_node_id: str):
        self.node_id = node_id
        self.peer_node_id = peer_node_id
        self._channel = None

    async def connect(self) -> None:
        # TASK 5: replace with real AXL SDK call, e.g.:
        #   from axl import AXLClient
        #   self._channel = await AXLClient.connect(self.node_id, self.peer_node_id)
        logger.info("AXL connect (stub): %s → %s", self.node_id, self.peer_node_id)
        self._channel = object()  # placeholder sentinel

    async def send(self, message: dict) -> None:
        if not self._channel:
            raise RuntimeError("AXL channel not open — call connect() first")
        payload = json.dumps(message).encode()
        # TASK 5: replace with: await self._channel.send(payload)
        logger.info("AXL send (stub): type=%s", message.get("type"))

    async def receive(self) -> dict:
        if not self._channel:
            raise RuntimeError("AXL channel not open — call connect() first")
        # TASK 5: replace with:
        #   raw = await self._channel.receive()
        #   return json.loads(raw)
        raise NotImplementedError("AXL receive: wire up real SDK in Task 5")

    async def close(self) -> None:
        if self._channel:
            # TASK 5: replace with: await self._channel.close()
            self._channel = None
        logger.info("AXL channel closed (stub)")

    async def __aenter__(self) -> "AXLSession":
        await self.connect()
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()
