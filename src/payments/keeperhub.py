# src/payments/keeperhub.py
import logging
import os
from dataclasses import dataclass

import httpx

from src.payments.receipt import Receipt

logger = logging.getLogger(__name__)


@dataclass
class TollPaymentRequest:
    workflow_id: str
    amount: str
    currency: str
    from_wallet: str
    caller_ens: str


class KeeperHubClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.environ.get("KEEPERHUB_API_KEY")
        if not self.api_key:
            raise ValueError("KEEPERHUB_API_KEY env var or api_key argument required")
        self.base_url = (base_url or os.environ.get("KEEPERHUB_BASE_URL", "https://api.keeperhub.com")).rstrip("/")

    async def _post(self, path: str, body: dict) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}{path}",
                json=body,
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def pay_workflow(self, req: TollPaymentRequest) -> Receipt:
        body = {
            "workflow_id": req.workflow_id,
            "amount": req.amount,
            "currency": req.currency,
            "from": req.from_wallet,
            "metadata": {
                "purpose": "inbound_channel",
                "caller_ens": req.caller_ens,
            },
        }
        logger.info("KeeperHub pay_workflow: %s amount=%s %s", req.workflow_id, req.amount, req.currency)
        data = await self._post("/v1/workflows/pay", body)
        receipt = Receipt(
            tx_hash=data.get("tx_hash", ""),
            signed_receipt=data.get("signed_receipt", ""),
            status=data.get("status", "pending"),
        )
        logger.info("KeeperHub receipt: status=%s tx=%s", receipt.status, receipt.tx_hash)
        return receipt

    async def execute_workflow(self, workflow_id: str, params: dict, audit_tag: str) -> Receipt:
        body = {
            "workflow_id": workflow_id,
            "params": params,
            "audit_tag": audit_tag,
        }
        logger.info("KeeperHub execute_workflow: %s tag=%s", workflow_id, audit_tag)
        data = await self._post("/v1/workflows/execute", body)
        receipt = Receipt(
            tx_hash=data.get("tx_hash", ""),
            signed_receipt=data.get("signed_receipt", ""),
            status=data.get("status", "pending"),
        )
        logger.info("KeeperHub receipt: status=%s tx=%s", receipt.status, receipt.tx_hash)
        return receipt
