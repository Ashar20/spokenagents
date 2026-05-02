# src/ens/resolver.py
"""
ENS resolver for Tollgate agent records.

Reads text records from the public resolver on the configured chain via web3.py.
The chain is determined by RPC_URL — this works for any EVM ENS deployment
(mainnet, Sepolia, etc.) as the records use the standard Resolver.text(node, key) API.
"""
import json
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AgentRecord:
    """Full agent record from ENS text records."""
    role: str = ""               # "caller" | "callee"
    axl_node: str = ""           # 64-char hex peer id
    bridge_url: str = ""         # AXL HTTP bridge URL
    wallet: str = ""             # contact wallet (sender or receiver)
    toll_price: str = "0"        # decimal string in human-readable units
    currency: str = "USDC"
    workflow_id: str = ""        # KH workflow id
    capabilities: list[str] = field(default_factory=list)
    agent_version: str = "tollgate/0.1"


# ENS text record keys ↔ AgentRecord fields
TEXT_KEY_MAP = {
    "agent.role":       "role",
    "axl.node":         "axl_node",
    "axl.bridge_url":   "bridge_url",
    "contact.wallet":   "wallet",
    "contact.price":    "toll_price",
    "contact.currency": "currency",
    "contact.workflow": "workflow_id",
    "capabilities":     "capabilities",   # parsed below
    "agent.version":    "agent_version",
}


def _parse_text_records(raw: dict[str, str]) -> AgentRecord:
    fields: dict = {}
    for ens_key, attr in TEXT_KEY_MAP.items():
        v = raw.get(ens_key)
        if v is None or v == "":
            continue
        if attr == "capabilities":
            try:
                fields[attr] = json.loads(v)
            except json.JSONDecodeError:
                fields[attr] = [c.strip() for c in v.split(",") if c.strip()]
        else:
            fields[attr] = v
    return AgentRecord(**fields)


async def resolve_agent_records(ens_name: str, rpc_url: str | None = None) -> AgentRecord:
    """Resolve agent text records from the configured chain's ENS.

    Raises:
        ValueError: no RPC configured
        ConnectionError: RPC is unreachable (chain id probe failed)
        LookupError: ENS reachable but the name has no records we recognize
    """
    import asyncio

    from web3 import AsyncWeb3
    from web3.exceptions import Web3Exception

    url = rpc_url or os.environ.get("RPC_URL")
    if not url:
        raise ValueError("rpc_url argument or RPC_URL env var required")
    name = ens_name.lower()
    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(url))

    # Cheap reachability probe — distinguishes "RPC down" from "name has no records"
    try:
        await w3.eth.chain_id
    except Exception as exc:
        raise ConnectionError(f"ENS RPC unreachable at {url}: {exc}") from exc

    async def _safe_get_text(key: str) -> tuple[str, str | None]:
        try:
            return key, await w3.ens.get_text(name, key)
        except Web3Exception as exc:
            logger.warning("ENS text lookup failed for %s[%s]: %s", name, key, exc)
            return key, None

    results = await asyncio.gather(*[_safe_get_text(k) for k in TEXT_KEY_MAP])
    raw = {k: v for k, v in results if v}
    if not raw:
        raise LookupError(f"No ENS text records found for {name}")
    return _parse_text_records(raw)
