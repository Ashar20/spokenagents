# tests/test_session.py
import pytest
from src.protocol.session import AXLSession


@pytest.mark.asyncio
async def test_connect_sets_channel():
    session = AXLSession(node_id="alex", peer_node_id="bella")
    assert session._channel is None
    await session.connect()
    assert session._channel is not None


@pytest.mark.asyncio
async def test_send_before_connect_raises():
    session = AXLSession(node_id="alex", peer_node_id="bella")
    with pytest.raises(RuntimeError, match="not open"):
        await session.send({"type": "PROPOSE"})


@pytest.mark.asyncio
async def test_send_after_connect_succeeds():
    session = AXLSession(node_id="alex", peer_node_id="bella")
    await session.connect()
    await session.send({"type": "PROPOSE", "date": "2026-05-02"})  # should not raise


@pytest.mark.asyncio
async def test_receive_raises_not_implemented():
    session = AXLSession(node_id="alex", peer_node_id="bella")
    await session.connect()
    with pytest.raises(NotImplementedError):
        await session.receive()


@pytest.mark.asyncio
async def test_close_clears_channel():
    session = AXLSession(node_id="alex", peer_node_id="bella")
    await session.connect()
    await session.close()
    assert session._channel is None


@pytest.mark.asyncio
async def test_context_manager():
    async with AXLSession(node_id="alex", peer_node_id="bella") as session:
        assert session._channel is not None
    assert session._channel is None
