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
import json
import logging
import os
from dataclasses import dataclass

import httpx

from src.payments.receipt import Receipt

logger = logging.getLogger(__name__)


@dataclass
class TollPaymentRequest:
    """PRD-shape payment request.

    Mirrors the canonical pay_workflow signature:
        keeperhub.pay_workflow(
            workflow_id, amount, currency, from=alex_wallet,
            metadata={purpose, caller_ens},
        )
    The `to_wallet` field is the receiving address resolved from the callee's
    ENS contact.wallet text record. KH signs the actual transfer from its
    own integration wallet (which must equal `from_wallet` for audit accuracy).
    """
    workflow_id: str          # KH workflow id (from contact.workflow ENS record)
    amount: str               # human-readable USDC, e.g. "0.05"
    currency: str             # "USDC"
    from_wallet: str          # alex's wallet (PRD `from`)
    to_wallet: str            # bella's receiving wallet (resolved from ENS)
    metadata: dict            # PRD metadata: {purpose, caller_ens}


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
                # Synchronous tool calls only — drop SSE so r.json() always works (C4)
                "Accept": "application/json",
            },
        )
        self._sid: str | None = None
        # _initialized flips True only after BOTH initialize and the
        # initialized notification complete, preventing C2 partial-init races.
        self._initialized = False
        self._init_lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _ensure_session(self) -> None:
        if self._initialized:
            return
        async with self._init_lock:
            if self._initialized:
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
            sid = r.headers.get("mcp-session-id")
            if not sid:
                raise RuntimeError("MCP server returned no session id on initialize")
            await self._client.post(self.mcp_url, json={
                "jsonrpc": "2.0", "method": "notifications/initialized",
            }, headers={"mcp-session-id": sid})
            # Publish session id only after both steps succeed (C2 fix)
            self._sid = sid
            self._initialized = True

    async def _call_tool(self, name: str, arguments: dict, *, rpc_id: int = 99) -> dict:
        await self._ensure_session()
        h = {"mcp-session-id": self._sid} if self._sid else {}
        r = await self._client.post(self.mcp_url, json={
            "jsonrpc": "2.0", "id": rpc_id, "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }, headers=h)
        r.raise_for_status()
        try:
            body = r.json()
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"MCP non-JSON response: {r.text[:200]}") from exc
        if "error" in body:
            raise RuntimeError(f"MCP error: {body['error']}")
        # Defensive parsing (C3): every layer below result.content[0].text can
        # be missing/empty/non-JSON depending on the tool's behavior.
        content = (body.get("result") or {}).get("content") or []
        if not content:
            return {}
        text = content[0].get("text", "") if isinstance(content[0], dict) else ""
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"_raw": text}

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

        # Always poll at least once: the initial response can return
        # status=completed without transactionHash.
        terminal = ("failed", "error", "cancelled")
        loop = asyncio.get_event_loop()
        deadline = loop.time() + 60
        while loop.time() < deadline:
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

    @staticmethod
    def _chain_and_token() -> tuple[str, str]:
        return (
            os.environ.get("KH_CHAIN_ID", SEPOLIA_CHAIN_ID),
            os.environ.get("KH_TOKEN_ADDRESS", USDC_SEPOLIA),
        )

    async def pay_workflow(self, req: TollPaymentRequest) -> Receipt:
        """Pay the toll using the recipient resolved by the caller (typically
        from the callee's ENS contact.wallet text record).

        `req.metadata` is included for the audit trail (KH's `execute_transfer`
        doesn't surface it on-chain, but it's preserved by the caller for
        forwarding over AXL).
        """
        chain_id, token = self._chain_and_token()
        logger.info(
            "KH pay_workflow (toll): wf=%s %s %s from=%s → to=%s metadata=%s chain=%s",
            req.workflow_id, req.amount, req.currency,
            req.from_wallet, req.to_wallet, req.metadata, chain_id,
        )
        return await self._direct_transfer(req.to_wallet, req.amount, chain_id, token)

    async def execute_workflow(self, workflow_id: str, params: dict, audit_tag: str) -> Receipt:
        """Settlement — same direct transfer with the deposit amount."""
        recipient = params.get("recipient", os.environ["BELLA_WALLET_ADDRESS"])
        amount = str(params["amount"])
        chain_id, token = self._chain_and_token()
        logger.info(
            "KH execute_workflow (settlement): %s → %s tag=%s",
            amount, recipient, audit_tag,
        )
        return await self._direct_transfer(recipient, amount, chain_id, token)
