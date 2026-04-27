# src/audio/events.py
"""
Audio event server for Tollgate demo UI.

Runs a websocket server that the browser connects to.
Agent code calls AudioEventEmitter.emit() to broadcast events.
Browser (Tone.js) maps events to sounds.

Start server: await AudioEventEmitter.serve()
"""
import asyncio
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_connected_clients: set = set()


async def _ws_handler(websocket) -> None:
    _connected_clients.add(websocket)
    logger.info("Demo UI connected (total: %d)", len(_connected_clients))
    try:
        await websocket.wait_closed()
    finally:
        _connected_clients.discard(websocket)
        logger.info("Demo UI disconnected (total: %d)", len(_connected_clients))


async def broadcast(event_type: str, data: Optional[dict] = None) -> None:
    if not _connected_clients:
        return
    payload = json.dumps({"event": event_type, **(data or {})})
    await asyncio.gather(
        *[ws.send(payload) for ws in list(_connected_clients)],
        return_exceptions=True,
    )


class AudioEventEmitter:
    def __init__(self, ws_url: str = "ws://localhost:8765"):
        self.ws_url = ws_url
        self._ws = None

    async def connect(self) -> None:
        try:
            import websockets
            self._ws = await websockets.connect(self.ws_url)
            logger.info("AudioEventEmitter connected to %s", self.ws_url)
        except Exception as exc:
            logger.warning("AudioEventEmitter: could not connect to %s: %s", self.ws_url, exc)

    def emit(self, event_type: str, data: Optional[dict] = None) -> None:
        if not self._ws:
            return
        payload = json.dumps({"event": event_type, **(data or {})})
        try:
            asyncio.get_running_loop()  # raises RuntimeError if no loop running
            asyncio.create_task(self._ws.send(payload))
        except Exception as exc:
            logger.warning("AudioEventEmitter emit failed: %s", exc)

    async def aemit(self, event_type: str, data: Optional[dict] = None) -> None:
        if not self._ws:
            return
        payload = json.dumps({"event": event_type, **(data or {})})
        try:
            await self._ws.send(payload)
        except Exception as exc:
            logger.warning("AudioEventEmitter aemit failed: %s", exc)

    async def close(self) -> None:
        if self._ws:
            await self._ws.close()
            self._ws = None

    @staticmethod
    async def serve(host: str = "localhost", port: int = 8765) -> None:
        import websockets
        logger.info("Audio event server listening on ws://%s:%d", host, port)
        async with websockets.serve(_ws_handler, host, port):
            await asyncio.Future()  # run forever
