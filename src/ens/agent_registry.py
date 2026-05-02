"""
JSON-backed registry of agents we know about.

The on-chain ENS records are the source of truth, but maintaining a local
list of known ENS names lets us:
  - Enumerate known agents without scraping ENS subnodes
  - Search by capability for "find me an agent that does dining"
  - Cache resolved AgentRecords for fast UI listings

Persisted at data/agents.json. Each entry is just an ENS name; the full
record is fetched lazily via src.ens.resolver.
"""
import asyncio
import json
import logging
import os
from dataclasses import asdict, dataclass
from pathlib import Path

from src.ens.resolver import AgentRecord, resolve_agent_records

logger = logging.getLogger(__name__)

DEFAULT_PATH = Path(os.environ.get(
    "AGENT_REGISTRY_PATH",
    str(Path(__file__).parent.parent.parent / "data" / "agents.json"),
))


@dataclass
class AgentEntry:
    ens_name: str
    role: str = ""
    wallet: str = ""
    axl_node: str = ""
    bridge_url: str = ""
    toll_price: str = "0"
    currency: str = "USDC"
    workflow_id: str = ""
    capabilities: list[str] = None
    agent_version: str = "tollgate/0.1"

    def to_dict(self) -> dict:
        d = asdict(self)
        if d["capabilities"] is None:
            d["capabilities"] = []
        return d


def _load_names(path: Path = DEFAULT_PATH) -> list[str]:
    if not path.exists():
        return []
    return json.loads(path.read_text()).get("agents", [])


def _save_names(names: list[str], path: Path = DEFAULT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"agents": sorted(set(names))}, indent=2))


def add(ens_name: str, path: Path = DEFAULT_PATH) -> None:
    names = _load_names(path)
    if ens_name not in names:
        names.append(ens_name)
        _save_names(names, path)
        logger.info("Registry: added %s", ens_name)


def remove(ens_name: str, path: Path = DEFAULT_PATH) -> bool:
    names = _load_names(path)
    if ens_name not in names:
        return False
    names.remove(ens_name)
    _save_names(names, path)
    logger.info("Registry: removed %s", ens_name)
    return True


def list_names(path: Path = DEFAULT_PATH) -> list[str]:
    return _load_names(path)


async def list_resolved(path: Path = DEFAULT_PATH) -> list[AgentEntry]:
    """Resolve every known ENS name in parallel. Skip entries that fail."""
    names = _load_names(path)

    async def _one(name: str) -> AgentEntry | None:
        try:
            rec = await resolve_agent_records(name)
            return AgentEntry(
                ens_name=name,
                role=rec.role,
                wallet=rec.wallet,
                axl_node=rec.axl_node,
                bridge_url=rec.bridge_url,
                toll_price=rec.toll_price,
                currency=rec.currency,
                workflow_id=rec.workflow_id,
                capabilities=rec.capabilities,
                agent_version=rec.agent_version,
            )
        except Exception as exc:
            logger.warning("Registry skip %s: %s", name, exc)
            return None

    results = await asyncio.gather(*[_one(n) for n in names])
    return [r for r in results if r]


async def find_by_capability(capability: str, path: Path = DEFAULT_PATH) -> list[AgentEntry]:
    cap = capability.lower()
    return [
        a for a in await list_resolved(path)
        if any(c.lower() == cap for c in (a.capabilities or []))
    ]
