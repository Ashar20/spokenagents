"""
Bella AXL responder for the Tollgate demo.

On every incoming PROPOSE:
  1. Verify the toll receipt (status=confirmed + non-empty tx_hash).
  2. Resolve the caller's ENS name to an AgentRecord (5-min cached).
  3. Reject unless agent.role == "caller".
  4. ACCEPT with a small fixed deposit so the demo wallet doesn't drain.

Run alongside the AXL nodes:
  .venv/bin/python -m scripts.bella_responder
"""
import asyncio
import logging
import os
import time

from dotenv import load_dotenv

from src.ens.resolver import AgentRecord, resolve_agent_records
from src.protocol.messages import AcceptMessage, RejectMessage
from src.protocol.session import AXLSession
from src.protocol.toll_gate import check_toll

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("bella_responder")

BELLA_BRIDGE = os.environ.get("BELLA_AXL_NODE", "http://127.0.0.1:9112")
ALEX_PEER_ID = os.environ.get("ALEX_PEER_ID", "")

if not ALEX_PEER_ID:
    raise SystemExit("ALEX_PEER_ID env var required (Alex's 64-char hex public key)")

# Tiny ENS cache so a transient RPC blip during a demo doesn't reject Alex
# right after we successfully resolved him. (key, fetched_at, record)
_ENS_CACHE: dict[str, tuple[float, AgentRecord]] = {}
_ENS_CACHE_TTL = 5 * 60  # seconds


async def verify_caller_ens(caller_ens: str) -> tuple[bool, str]:
    """Resolve the caller's ENS record. Distinguish transient errors from
    permanent ones (unknown name / wrong role) so we don't reject good
    callers when the RPC blips."""
    if not caller_ens:
        return False, "no caller_ens supplied"

    cached = _ENS_CACHE.get(caller_ens.lower())
    if cached and time.time() - cached[0] < _ENS_CACHE_TTL:
        rec = cached[1]
        if rec.role != "caller":
            return False, f"agent.role={rec.role!r} (expected 'caller')"
        return True, f"verified caller={caller_ens} (cached)"

    try:
        rec = await resolve_agent_records(caller_ens)
    except LookupError:
        return False, f"ENS name {caller_ens} has no agent records"
    except (ConnectionError, Exception) as exc:
        # Transient: if we have ANY cached record we accept-with-warning;
        # otherwise reject (we can't validate)
        if cached:
            logger.warning("ENS RPC down (%s) — using stale cache for %s", exc, caller_ens)
            rec = cached[1]
        else:
            return False, f"ENS lookup transient failure: {exc}"

    _ENS_CACHE[caller_ens.lower()] = (time.time(), rec)
    if rec.role != "caller":
        return False, f"agent.role={rec.role!r} (expected 'caller')"
    return True, f"verified caller={caller_ens} wallet={rec.wallet}"


async def handle_propose(msg: dict) -> dict:
    receipt = msg.get("toll_receipt", {})
    caller_ens = msg.get("caller_ens", "")

    # Toll receipt must be present and confirmed
    ok, reason = check_toll(receipt)
    if not ok:
        logger.warning("REJECT (toll): %s", reason)
        return RejectMessage(reason=reason).to_dict()

    # Caller must be a known agent in the registry
    ok, reason = await verify_caller_ens(caller_ens)
    if not ok:
        logger.warning("REJECT (registry): %s", reason)
        return RejectMessage(reason=reason).to_dict()

    date = msg.get("date", "Friday")
    party = msg.get("party_size", 4)
    deposit = msg.get("deposit_amount", "20")
    logger.info(
        "PROPOSE accepted: caller=%s date=%s party=%s deposit=%s tx=%s…",
        caller_ens, date, party, deposit, receipt.get("tx_hash", "")[:14],
    )
    # Cap deposit so the demo wallet doesn't drain in a few runs
    return AcceptMessage(
        slot_id="BELLA-FRI-8PM",
        deposit_amount="0.10",
        terms_hash="0xterms-mock",
    ).to_dict()


async def main() -> None:
    logger.info("Bella responder starting: bridge=%s peer=%s", BELLA_BRIDGE, ALEX_PEER_ID[:12])
    async with AXLSession(bridge_url=BELLA_BRIDGE, peer_peer_id=ALEX_PEER_ID) as session:
        logger.info("Bella ready. Waiting for messages from Alex...")
        while True:
            try:
                msg = await session.receive(timeout=300.0)
            except TimeoutError:
                logger.debug("recv idle, polling again")
                continue
            except Exception as exc:
                logger.error("receive error: %s", exc)
                await asyncio.sleep(1)
                continue

            mtype = msg.get("type")
            logger.info("Bella received: %s", mtype)

            if mtype == "PROPOSE":
                reply = await handle_propose(msg)
                await session.send(reply)
                logger.info("Bella sent: %s", reply.get("type"))
            elif mtype == "CONFIRM":
                logger.info("Booking confirmed by Alex: slot=%s", msg.get("slot_id"))
            else:
                logger.warning("Bella ignoring unknown message type: %s", mtype)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bella responder stopped.")
