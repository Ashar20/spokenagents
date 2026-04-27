# tests/test_keeperhub.py
import pytest
from unittest.mock import AsyncMock, patch
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import Receipt, verify_receipt


@pytest.mark.asyncio
async def test_pay_workflow_returns_confirmed_receipt():
    client = KeeperHubClient(api_key="test-key", base_url="http://mock")
    mock_response = {
        "tx_hash": "0xabc123",
        "signed_receipt": "sig_xyz",
        "status": "confirmed",
    }
    with patch.object(client, "_post", new_callable=AsyncMock, return_value=mock_response):
        receipt = await client.pay_workflow(TollPaymentRequest(
            workflow_id="bella/inbound-toll",
            amount="0.25",
            currency="USDC",
            from_wallet="0xAlexWallet",
            caller_ens="alex.eth",
        ))
    assert receipt.tx_hash == "0xabc123"
    assert receipt.status == "confirmed"
    assert receipt.signed_receipt == "sig_xyz"


@pytest.mark.asyncio
async def test_execute_workflow_returns_receipt():
    client = KeeperHubClient(api_key="test-key", base_url="http://mock")
    mock_response = {
        "tx_hash": "0xdef456",
        "signed_receipt": "sig_abc",
        "status": "confirmed",
    }
    with patch.object(client, "_post", new_callable=AsyncMock, return_value=mock_response):
        receipt = await client.execute_workflow(
            workflow_id="bella/booking-deposit",
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
async def test_pay_workflow_sends_correct_body():
    client = KeeperHubClient(api_key="test-key", base_url="http://mock")
    mock_response = {"tx_hash": "0x1", "signed_receipt": "s", "status": "confirmed"}

    with patch.object(client, "_post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
        await client.pay_workflow(TollPaymentRequest(
            workflow_id="bella/inbound-toll",
            amount="0.25",
            currency="USDC",
            from_wallet="0xAlex",
            caller_ens="alex.eth",
        ))

    call_args = mock_post.call_args
    path, body = call_args[0]
    assert body["workflow_id"] == "bella/inbound-toll"
    assert body["amount"] == "0.25"
    assert body["metadata"]["purpose"] == "inbound_channel"
    assert body["metadata"]["caller_ens"] == "alex.eth"
