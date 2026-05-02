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
