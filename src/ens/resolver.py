# src/ens/resolver.py
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

@dataclass
class AgentRecord:
    axl_node: str
    toll_price: str
    currency: str = "USDC"
    workflow_id: str = ""
    capabilities: list[str] = field(default_factory=list)
    agent_version: str = "tollgate/0.1"


def _parse_text_records(raw: dict) -> AgentRecord:
    caps_raw = raw.get("capabilities", "[]")
    try:
        capabilities = json.loads(caps_raw)
    except json.JSONDecodeError:
        capabilities = [c.strip() for c in caps_raw.split(",") if c.strip()]
    return AgentRecord(
        axl_node=raw.get("axl.node", ""),
        toll_price=raw.get("contact.price", "0"),
        currency=raw.get("contact.currency", "USDC"),
        workflow_id=raw.get("contact.workflow", ""),
        capabilities=capabilities,
        agent_version=raw.get("agent.version", "tollgate/0.1"),
    )


async def resolve_agent_records(ens_name: str, rpc_url: Optional[str] = None) -> AgentRecord:
    from web3 import AsyncWeb3

    url = rpc_url or os.environ.get("RPC_URL")
    if not url:
        raise ValueError("rpc_url argument or RPC_URL env var required")
    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(url))
    TEXT_KEYS = [
        "axl.node", "contact.price", "contact.currency",
        "contact.workflow", "capabilities", "agent.version",
    ]
    raw: dict = {}
    for key in TEXT_KEYS:
        try:
            value = await w3.ens.get_text(ens_name, key)
            if value:
                raw[key] = value
        except Exception as exc:
            logger.warning("ENS text lookup failed for %s[%s]: %s", ens_name, key, exc)
    return _parse_text_records(raw)
