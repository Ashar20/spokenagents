"""
Mock ENS registry for the Tollgate demo.

Real ENS records on Sepolia would expose the same fields as text records:
  agent.role            "caller" | "callee"
  axl.node              <64-char hex peer id>
  axl.bridge_url        http://...:9112
  contact.wallet        0x...
  contact.price         "0.05"
  contact.currency      "USDC"
  contact.workflow      <KeeperHub workflow id>
  capabilities          JSON list

For the single-host demo we resolve them from this in-memory dict.
Switch to on-chain lookup by setting USE_REAL_ENS=true in .env.
"""
import json
import logging
import os
from dataclasses import asdict, dataclass, field

from src.ens.resolver import AgentRecord, resolve_agent_records

logger = logging.getLogger(__name__)


@dataclass
class FullAgentRecord(AgentRecord):
    """Extends AgentRecord with the additional fields needed for the registry."""
    role: str = "callee"            # "caller" | "callee"
    bridge_url: str = ""             # AXL HTTP bridge URL
    wallet: str = ""                 # receiving / sending wallet address


# Mock registry — swap for real ENS by setting USE_REAL_ENS=true
_MOCK_REGISTRY: dict[str, FullAgentRecord] = {
    "alex.eth": FullAgentRecord(
        role="caller",
        axl_node="1fc5fc5c98ee3b8291abdaf942ad1c1b57cc611e7bd3ad80e7b8c7b833891763",
        bridge_url="http://127.0.0.1:9102",
        wallet="0x30b748f458ab37957d0b6a291e6d64dff10f94a3",
        toll_price="0",
        currency="USDC",
        capabilities=["voice", "ordering"],
    ),
    "bella.eth": FullAgentRecord(
        role="callee",
        axl_node="ba83aeb4556aacf342914cca2bfe3876386310c46d1bcade052bb86d0e983bfc",
        bridge_url="http://127.0.0.1:9112",
        wallet="0x5c47cdDD0e3e0905062e2799B868C5b7648C99e7",
        toll_price="0.05",
        currency="USDC",
        workflow_id="quhvp6sapu0agrs7khgej",
        capabilities=["dining", "booking"],
    ),
}


async def lookup(ens_name: str) -> FullAgentRecord | None:
    """Look up an agent's full record by ENS name. Returns None if unknown."""
    if os.environ.get("USE_REAL_ENS", "false").lower() in ("true", "1", "yes"):
        try:
            base = await resolve_agent_records(ens_name)
            # Real ENS path: base lacks role/bridge_url/wallet fields by design.
            # Caller is responsible for filling them or the lookup may be incomplete.
            return FullAgentRecord(**asdict(base))
        except Exception as exc:
            logger.warning("Real ENS lookup failed for %s: %s", ens_name, exc)
            return None
    rec = _MOCK_REGISTRY.get(ens_name.lower())
    if rec:
        logger.info("Mock ENS lookup: %s → role=%s wallet=%s peer=%s…",
                    ens_name, rec.role, rec.wallet[:10], rec.axl_node[:12])
    else:
        logger.warning("Mock ENS lookup: %s → NOT FOUND", ens_name)
    return rec


def list_known_callers() -> list[str]:
    return [name for name, rec in _MOCK_REGISTRY.items() if rec.role == "caller"]


def is_known_caller(ens_name: str) -> bool:
    rec = _MOCK_REGISTRY.get((ens_name or "").lower())
    return rec is not None and rec.role == "caller"
