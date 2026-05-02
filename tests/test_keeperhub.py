# tests/test_keeperhub.py
import pytest
from unittest.mock import AsyncMock, patch
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import Receipt, verify_receipt


def _make_client(monkeypatch) -> KeeperHubClient:
    monkeypatch.setenv("BELLA_WALLET_ADDRESS", "0xBella")
    return KeeperHubClient(api_key="test-key", mcp_url="http://mock")


@pytest.mark.asyncio
async def test_pay_workflow_returns_confirmed_receipt(monkeypatch):
    client = _make_client(monkeypatch)
    mock = {
        "executionId": "exec_1",
        "status": "completed",
        "transactionHash": "0xabc123",
    }
    with patch.object(client, "_call_tool", new_callable=AsyncMock, return_value=mock):
        receipt = await client.pay_workflow(TollPaymentRequest(
            workflow_id="ignored",
            amount="0.25",
            currency="USDC",
            from_wallet="0xAlexWallet",
            caller_ens="alex.eth",
        ))
    assert receipt.tx_hash == "0xabc123"
    assert receipt.status == "confirmed"
    assert receipt.signed_receipt == "exec_1"


@pytest.mark.asyncio
async def test_execute_workflow_returns_receipt(monkeypatch):
    client = _make_client(monkeypatch)
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
async def test_pay_workflow_calls_execute_transfer_with_correct_args(monkeypatch):
    monkeypatch.setenv("BELLA_WALLET_ADDRESS", "0xBella")
    monkeypatch.setenv("KH_CHAIN_ID", "11155111")
    client = KeeperHubClient(api_key="test-key", mcp_url="http://mock")
    mock = {"executionId": "x", "status": "completed", "transactionHash": "0x1"}

    with patch.object(client, "_call_tool", new_callable=AsyncMock, return_value=mock) as call:
        await client.pay_workflow(TollPaymentRequest(
            workflow_id="ignored",
            amount="0.25",
            currency="USDC",
            from_wallet="0xAlex",
            caller_ens="alex.eth",
        ))

    name, args = call.call_args[0]
    assert name == "execute_transfer"
    assert args["network"] == "11155111"
    assert args["recipient_address"] == "0xBella"
    assert args["amount"] == "0.25"
