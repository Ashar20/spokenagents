# tests/test_toll_gate.py
from src.protocol.toll_gate import check_toll


def test_no_receipt_rejects():
    allowed, reason = check_toll(None)
    assert allowed is False
    assert "No toll receipt" in reason


def test_empty_dict_rejects():
    allowed, reason = check_toll({})
    assert allowed is False
    assert "not verified" in reason.lower() or "receipt" in reason.lower()


def test_pending_receipt_rejects():
    allowed, reason = check_toll({"tx_hash": "0xabc", "signed_receipt": "s", "status": "pending"})
    assert allowed is False


def test_confirmed_receipt_allows():
    allowed, reason = check_toll({"tx_hash": "0xabc", "signed_receipt": "s", "status": "confirmed"})
    assert allowed is True
    assert reason == "ok"


def test_failed_receipt_rejects():
    allowed, reason = check_toll({"tx_hash": "0xabc", "signed_receipt": "s", "status": "failed"})
    assert allowed is False
