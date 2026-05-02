# src/payments/keeperhub.py
"""
KeeperHub client.

Real implementation: talks to KeeperHub's MCP server at
https://app.keeperhub.com/mcp via JSON-RPC over HTTP.

The MCP `execute_transfer` tool moves USDC (or any ERC20) from the
connected wallet integration to a recipient on the requested chain.
We poll `get_direct_execution_status` until it terminates and convert
the result into a `Receipt`.
"""
import asyncio
import logging
import os
from dataclasses import dataclass

import httpx

from src.payments.receipt import Receipt

logger = logging.getLogger(__name__)


@dataclass
class TollPaymentRequest:
    workflow_id: str   # kept for backward-compat with negotiation.py; unused for direct transfer
    amount: str        # e.g. "0.25" — human-readable USDC units
    currency: str      # "USDC"
    from_wallet: str   # caller's wallet address (for audit only; KH signs from its integration)
    caller_ens: str    # for audit only


# Defaults read from env so callers don't have to plumb them
USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
SEPOLIA_CHAIN_ID = "11155111"


class KeeperHubClient:
    def __init__(self, api_key: str | None = None, mcp_url: str | None = None):
        self.api_key = api_key or os.environ.get("KEEPERHUB_API_KEY")
        if not self.api_key:
            raise ValueError("KEEPERHUB_API_KEY env var or api_key argument required")
        self.mcp_url = mcp_url or os.environ.get(
            "KEEPERHUB_MCP_URL", "https://app.keeperhub.com/mcp")
        self._client = httpx.AsyncClient(
            timeout=120,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
        )
        self._sid: str | None = None
        self._init_lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _ensure_session(self) -> None:
        if self._sid:
            return
        async with self._init_lock:
            if self._sid:
                return
            r = await self._client.post(self.mcp_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "tollgate", "version": "0.1"},
                },
            })
            r.raise_for_status()
            self._sid = r.headers.get("mcp-session-id")
            await self._client.post(self.mcp_url, json={
                "jsonrpc": "2.0", "method": "notifications/initialized",
            }, headers={"mcp-session-id": self._sid} if self._sid else {})

    async def _call_tool(self, name: str, arguments: dict, *, rpc_id: int = 99) -> dict:
        await self._ensure_session()
        h = {"mcp-session-id": self._sid} if self._sid else {}
        r = await self._client.post(self.mcp_url, json={
            "jsonrpc": "2.0", "id": rpc_id, "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }, headers=h)
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(f"MCP error: {body['error']}")
        text = body["result"]["content"][0]["text"]
        import json
        return json.loads(text)

    async def _direct_transfer(
        self,
        recipient: str,
        amount: str,
        chain_id: str = SEPOLIA_CHAIN_ID,
        token_address: str = USDC_SEPOLIA,
    ) -> Receipt:
        result = await self._call_tool("execute_transfer", {
            "network": chain_id,
            "recipient_address": recipient,
            "amount": amount,
            "token_address": token_address,
        })
        exec_id = result.get("executionId") or result.get("execution_id")
        status = result.get("status", "pending")
        logger.info("KH execute_transfer: id=%s initial_status=%s", exec_id, status)

        # Poll until we have a tx_hash or hit a terminal failure or timeout.
        # The initial response can return status=completed without the hash,
        # so we always poll at least once.
        deadline = asyncio.get_event_loop().time() + 60
        terminal = ("failed", "error", "cancelled")
        while asyncio.get_event_loop().time() < deadline:
            poll = await self._call_tool(
                "get_direct_execution_status", {"execution_id": exec_id})
            result.update(poll)
            status = poll.get("status", status)
            if status in terminal:
                break
            if status in ("completed", "success") and result.get("transactionHash"):
                break
            await asyncio.sleep(1.5)

        tx_hash = result.get("transactionHash") or ""
        if status in terminal or not tx_hash:
            raise RuntimeError(
                f"KH transfer failed (status={status}): {result.get('error', result)}"
            )
        receipt = Receipt(
            tx_hash=tx_hash,
            signed_receipt=exec_id or "",
            status="confirmed",
        )
        logger.info("KH transfer confirmed: tx=%s", tx_hash)
        return receipt

    async def pay_workflow(self, req: TollPaymentRequest) -> Receipt:
        """
        Pay the toll. The destination address is read from BELLA_WALLET_ADDRESS
        env var; the chain and token from KH_CHAIN_ID + KH_TOKEN_ADDRESS
        (defaulting to Sepolia USDC).
        """
        recipient = os.environ["BELLA_WALLET_ADDRESS"]
        chain_id = os.environ.get("KH_CHAIN_ID", SEPOLIA_CHAIN_ID)
        token = os.environ.get("KH_TOKEN_ADDRESS", USDC_SEPOLIA)
        logger.info(
            "KH pay_workflow (toll): %s %s → %s on chain %s",
            req.amount, req.currency, recipient, chain_id,
        )
        return await self._direct_transfer(recipient, req.amount, chain_id, token)

    async def execute_workflow(self, workflow_id: str, params: dict, audit_tag: str) -> Receipt:
        """Settlement — same direct transfer with the deposit amount."""
        recipient = params.get("recipient", os.environ["BELLA_WALLET_ADDRESS"])
        amount = str(params["amount"])
        chain_id = os.environ.get("KH_CHAIN_ID", SEPOLIA_CHAIN_ID)
        token = os.environ.get("KH_TOKEN_ADDRESS", USDC_SEPOLIA)
        logger.info(
            "KH execute_workflow (settlement): %s → %s tag=%s",
            amount, recipient, audit_tag,
        )
        return await self._direct_transfer(recipient, amount, chain_id, token)
