# src/protocol/toll_gate.py
"""
Toll gate for Bella's callee agent.

Checks whether an incoming session has a valid toll receipt before
allowing the negotiation to proceed.
"""
import logging
from src.payments.receipt import Receipt, verify_receipt

logger = logging.getLogger(__name__)


def check_toll(receipt_data: dict | None) -> tuple[bool, str]:
    """
    Returns (allowed, reason).

    allowed=True if receipt_data is present and verified.
    reason is a human-readable explanation on rejection.
    """
    if not receipt_data:
        return False, "No toll receipt provided"

    try:
        receipt = Receipt(
            tx_hash=receipt_data.get("tx_hash", ""),
            signed_receipt=receipt_data.get("signed_receipt", ""),
            status=receipt_data.get("status", ""),
        )
    except Exception as exc:
        return False, f"Malformed receipt: {exc}"

    if not verify_receipt(receipt):
        return False, f"Receipt not verified: status={receipt.status!r}, tx_hash={receipt.tx_hash!r}"

    logger.info("Toll gate: PASS tx=%s", receipt.tx_hash)
    return True, "ok"
