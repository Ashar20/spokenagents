# src/payments/receipt.py
from dataclasses import dataclass


@dataclass
class Receipt:
    tx_hash: str
    signed_receipt: str
    status: str  # "pending" | "confirmed" | "failed"


def verify_receipt(receipt: Receipt) -> bool:
    """MVP: trust KeeperHub's status field. Stretch: verify on-chain."""
    return receipt.status == "confirmed" and bool(receipt.tx_hash)
