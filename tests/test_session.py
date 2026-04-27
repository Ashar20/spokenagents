# tests/test_session.py
"""
AXLSession tests using mocked aiohttp to avoid requiring live AXL nodes.
The real HTTP bridge integration is exercised by scripts/axl_smoke_test.py --real.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from src.protocol.session import AXLSession


def _make_mock_session(topology_key="abc123", recv_status=204):
    """Returns a mock aiohttp.ClientSession with preset responses."""
    topo_resp = AsyncMock()
    topo_resp.__aenter__ = AsyncMock(return_value=topo_resp)
    topo_resp.__aexit__ = AsyncMock(return_value=False)
    topo_resp.status = 200
    topo_resp.raise_for_status = MagicMock()
    topo_resp.json = AsyncMock(return_value={"our_public_key": topology_key})

    send_resp = AsyncMock()
    send_resp.__aenter__ = AsyncMock(return_value=send_resp)
    send_resp.__aexit__ = AsyncMock(return_value=False)
    send_resp.status = 200
    send_resp.raise_for_status = MagicMock()

    recv_resp = AsyncMock()
    recv_resp.__aenter__ = AsyncMock(return_value=recv_resp)
    recv_resp.__aexit__ = AsyncMock(return_value=False)
    recv_resp.status = recv_status
    recv_resp.read = AsyncMock(return_value=json.dumps({"type": "ACCEPT", "slot_id": "s"}).encode())

    mock_session = MagicMock()
    mock_session.close = AsyncMock()
    mock_session.get = MagicMock(side_effect=[topo_resp, recv_resp])
    mock_session.post = MagicMock(return_value=send_resp)
    return mock_session


@pytest.mark.asyncio
async def test_connect_sets_channel():
    session = AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc")
    assert session._channel is None
    with patch("aiohttp.ClientSession", return_value=_make_mock_session()):
        await session.connect()
    assert session._channel is not None
    await session.close()


@pytest.mark.asyncio
async def test_send_before_connect_raises():
    session = AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc")
    with pytest.raises(RuntimeError, match="not open"):
        await session.send({"type": "PROPOSE"})


@pytest.mark.asyncio
async def test_send_after_connect_succeeds():
    session = AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc")
    mock = _make_mock_session()
    with patch("aiohttp.ClientSession", return_value=mock):
        await session.connect()
        await session.send({"type": "PROPOSE", "date": "2026-05-02"})
    await session.close()


@pytest.mark.asyncio
async def test_receive_before_connect_raises():
    session = AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc")
    with pytest.raises(RuntimeError, match="not open"):
        await session.receive()


@pytest.mark.asyncio
async def test_receive_returns_message_on_200():
    session = AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc")
    mock = _make_mock_session(recv_status=200)
    with patch("aiohttp.ClientSession", return_value=mock):
        await session.connect()
        msg = await session.receive()
    assert msg["type"] == "ACCEPT"
    await session.close()


@pytest.mark.asyncio
async def test_close_clears_channel():
    session = AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc")
    with patch("aiohttp.ClientSession", return_value=_make_mock_session()):
        await session.connect()
        await session.close()
    assert session._channel is None


@pytest.mark.asyncio
async def test_context_manager():
    with patch("aiohttp.ClientSession", return_value=_make_mock_session()):
        async with AXLSession(bridge_url="http://127.0.0.1:9002", peer_peer_id="peer-abc") as session:
            assert session._channel is not None
    assert session._channel is None
