# tests/test_keeperhub.py
import pytest
from unittest.mock import AsyncMock, patch
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import Receipt, verify_receipt


def _toll_req(**overrides) -> TollPaymentRequest:
    base = dict(
        workflow_id="bella/inbound-toll",
        amount="0.25",
        currency="USDC",
        from_wallet="0xAlex",
        to_wallet="0xBella",
        metadata={"purpose": "inbound_channel", "caller_ens": "alex.eth"},
    )
    base.update(overrides)
    return TollPaymentRequest(**base)


@pytest.mark.asyncio
async def test_pay_workflow_returns_confirmed_receipt():
    client = KeeperHubClient(api_key="test-key", mcp_url="http://mock")
    mock = {
        "executionId": "exec_1",
        "status": "completed",
        "transactionHash": "0xabc123",
    }
    with patch.object(client, "_call_tool", new_callable=AsyncMock, return_value=mock):
        receipt = await client.pay_workflow(_toll_req())
    assert receipt.tx_hash == "0xabc123"
    assert receipt.status == "confirmed"
    assert receipt.signed_receipt == "exec_1"


@pytest.mark.asyncio
async def test_execute_workflow_returns_receipt(monkeypatch):
    monkeypatch.setenv("BELLA_WALLET_ADDRESS", "0xBella")
    client = KeeperHubClient(api_key="test-key", mcp_url="http://mock")
    mock = {
        "executionId": "exec_2",
        "status": "completed",
        "transactionHash": "0xdef456",
    }
    with patch.object(client, "_call_tool", new_callable=AsyncMock, return_value=mock):
        receipt = await client.execute_workflow(
            workflow_id="ignored",
            params={"slot_id": "BELLA-FRI-8PM", "amount": "20.00", "terms_hash": "0xterms"},
            audit_tag="tollgate-session-test-123",
        )
    assert receipt.tx_hash == "0xdef456"
    assert receipt.status == "confirmed"


def test_verify_receipt_confirmed_with_hash():
    receipt = Receipt(tx_hash="0xabc", signed_receipt="valid_sig", status="confirmed")
    assert verify_receipt(receipt) is True


def test_verify_receipt_rejects_pending():
    receipt = Receipt(tx_hash="0xabc", signed_receipt="sig", status="pending")
    assert verify_receipt(receipt) is False


def test_verify_receipt_rejects_empty_hash():
    receipt = Receipt(tx_hash="", signed_receipt="sig", status="confirmed")
    assert verify_receipt(receipt) is False


def test_verify_receipt_rejects_failed():
    receipt = Receipt(tx_hash="0xabc", signed_receipt="sig", status="failed")
    assert verify_receipt(receipt) is False


@pytest.mark.asyncio
async def test_pay_workflow_routes_to_recipient(monkeypatch):
    monkeypatch.setenv("KH_CHAIN_ID", "11155111")
    client = KeeperHubClient(api_key="test-key", mcp_url="http://mock")
    mock = {"executionId": "x", "status": "completed", "transactionHash": "0x1"}

    with patch.object(client, "_call_tool", new_callable=AsyncMock, return_value=mock) as call:
        await client.pay_workflow(_toll_req(to_wallet="0xBellaSpecific"))

    # First call is execute_transfer; subsequent calls are get_direct_execution_status polls.
    first_name, first_args = call.call_args_list[0][0]
    assert first_name == "execute_transfer"
    assert first_args["network"] == "11155111"
    assert first_args["recipient_address"] == "0xBellaSpecific"
    assert first_args["amount"] == "0.25"


@pytest.mark.asyncio
async def test_polls_until_tx_hash_arrives(monkeypatch):
    """The first execute_transfer response can be status=completed without
    transactionHash; the polling loop must keep polling until tx arrives."""
    monkeypatch.setattr("asyncio.sleep", AsyncMock())  # don't actually sleep
    client = KeeperHubClient(api_key="k", mcp_url="http://mock")
    responses = iter([
        {"executionId": "x", "status": "running"},          # initial
        {"status": "running"},                              # poll 1: still running
        {"status": "completed", "transactionHash": "0xfeed"},  # poll 2: arrives
    ])

    async def fake(*a, **kw):
        return next(responses)

    with patch.object(client, "_call_tool", side_effect=fake):
        r = await client.pay_workflow(_toll_req())
    assert r.tx_hash == "0xfeed"
    assert r.status == "confirmed"


@pytest.mark.asyncio
async def test_terminal_failure_raises_with_kh_error(monkeypatch):
    monkeypatch.setattr("asyncio.sleep", AsyncMock())
    client = KeeperHubClient(api_key="k", mcp_url="http://mock")
    responses = iter([
        {"executionId": "x", "status": "running"},
        {"status": "failed", "error": "Insufficient USDC balance"},
    ])

    async def fake(*a, **kw):
        return next(responses)

    with patch.object(client, "_call_tool", side_effect=fake):
        with pytest.raises(RuntimeError, match="Insufficient USDC balance"):
            await client.pay_workflow(_toll_req())


@pytest.mark.asyncio
async def test_no_execution_id_raises(monkeypatch):
    """KH must return an executionId for us to poll on."""
    client = KeeperHubClient(api_key="k", mcp_url="http://mock")
    with patch.object(client, "_call_tool", new_callable=AsyncMock,
                      return_value={"status": "completed"}):
        with pytest.raises(RuntimeError, match="no executionId"):
            await client.pay_workflow(_toll_req())


@pytest.mark.asyncio
async def test_session_handshake_fires_once(monkeypatch):
    """_ensure_session must run initialize+notification exactly once across
    concurrent _call_tool invocations (C2 race fix)."""
    import httpx

    init_call_count = {"n": 0}
    notify_call_count = {"n": 0}
    tool_call_count = {"n": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        body = request.read()
        if b'"initialize"' in body:
            init_call_count["n"] += 1
            return httpx.Response(200, json={"result": {}}, headers={"mcp-session-id": "sid-test"})
        if b'"notifications/initialized"' in body:
            notify_call_count["n"] += 1
            return httpx.Response(202)
        # tools/call
        tool_call_count["n"] += 1
        return httpx.Response(200, json={
            "result": {"content": [{"type": "text", "text": '{"ok": true}'}]}
        })

    transport = httpx.MockTransport(handler)
    client = KeeperHubClient(api_key="k", mcp_url="http://mock")
    client._client = httpx.AsyncClient(transport=transport, headers={
        "Authorization": "Bearer k", "Content-Type": "application/json",
        "Accept": "application/json",
    })

    # Two concurrent tool calls should share one session handshake
    import asyncio
    await asyncio.gather(
        client._call_tool("any_tool", {}),
        client._call_tool("any_tool", {}),
    )
    await client.aclose()

    assert init_call_count["n"] == 1
    assert notify_call_count["n"] == 1
    assert tool_call_count["n"] == 2
    assert client._sid == "sid-test"
    assert client._initialized is True


@pytest.mark.asyncio
async def test_call_tool_handles_empty_content():
    """Defensive parsing (C3): empty content should return {}, not crash."""
    client = KeeperHubClient(api_key="k", mcp_url="http://mock")
    client._initialized = True
    client._sid = "sid"

    import httpx
    async def handler(request):
        return httpx.Response(200, json={"result": {"content": []}})
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    result = await client._call_tool("any", {})
    assert result == {}
    await client.aclose()


def test_parse_response_handles_sse():
    """C4: SSE-framed responses are parsed by pulling the last data: line."""
    sse_body = (
        "event: message\n"
        'data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"hi"}]}}\n'
        "\n"
    )
    body = KeeperHubClient._parse_response(sse_body, "text/event-stream; charset=utf-8")
    assert body["result"]["content"][0]["text"] == "hi"


def test_parse_response_handles_plain_json():
    body = KeeperHubClient._parse_response('{"result": {"x": 1}}', "application/json")
    assert body["result"]["x"] == 1


@pytest.mark.asyncio
async def test_call_tool_handles_non_json_text():
    """Defensive parsing (C3): non-JSON text wraps as {'_raw': ...}."""
    client = KeeperHubClient(api_key="k", mcp_url="http://mock")
    client._initialized = True
    client._sid = "sid"

    import httpx
    async def handler(request):
        return httpx.Response(200, json={
            "result": {"content": [{"type": "text", "text": "plain string"}]}
        })
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    result = await client._call_tool("any", {})
    assert result == {"_raw": "plain string"}
    await client.aclose()
