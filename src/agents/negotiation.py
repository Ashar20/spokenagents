# src/agents/negotiation.py
"""
Tollgate negotiation flow — called by the caller agent after agent-to-agent detection.

Flow:
  1. ENS lookup → get peer's AXL node, toll price, workflow ID
  2. KeeperHub toll payment → get receipt
  3. AXL session → PROPOSE → receive ACCEPT/COUNTER → CONFIRM
  4. KeeperHub settlement execution
  5. Return NegotiationResult

Audio events are emitted at each step for the demo UI.
"""
import asyncio
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from src.ens.resolver import AgentRecord, resolve_agent_records
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import Receipt, verify_receipt  # noqa: F401
from src.protocol.messages import AcceptMessage, ConfirmMessage, ProposeMessage
from src.protocol.session import AXLSession

logger = logging.getLogger(__name__)


@dataclass
class NegotiationResult:
    success: bool
    slot_id: str = ""
    deposit_amount: str = ""
    terms_hash: str = ""
    toll_receipt: Optional[Receipt] = None
    settlement_receipt: Optional[Receipt] = None
    error: str = ""
    timings: dict = field(default_factory=dict)


async def run_negotiation(
    callee_ens: str,
    booking_date: str,
    party_size: int,
    max_deposit: str,
    caller_wallet: str,
    caller_ens: str,
    audio_emitter=None,
) -> NegotiationResult:
    """
    Run the full Tollgate negotiation protocol.

    audio_emitter: optional AudioEventEmitter instance. If None, events are only logged.
    """
    session_id = str(uuid.uuid4())[:8]
    t_start = time.perf_counter()
    timings: dict[str, float] = {}

    async def emit(event: str, data: Optional[dict] = None) -> None:
        logger.info("[session %s] event: %s %s", session_id, event, data or "")
        if audio_emitter:
            await audio_emitter.aemit(event, data)

    # --- Phase 0: ENS lookup (or forced record for single-agent demo) ---
    logger.info("Resolving ENS: %s", callee_ens)
    await emit("ens_resolving", {"name": callee_ens})
    forced_node = os.environ.get("FORCE_BELLA_NODE")
    if forced_node:
        record = AgentRecord(
            axl_node=os.environ.get("BELLA_PEER_ID", ""),
            toll_price=os.environ.get("FORCE_TOLL_PRICE", "0.25"),
            currency=os.environ.get("FORCE_TOLL_CURRENCY", "USDC"),
            workflow_id=os.environ.get("BELLA_TOLL_WORKFLOW", "bella/inbound-toll"),
            capabilities=["dining"],
        )
        logger.info("Using forced Bella record (peer=%s, bridge=%s)", record.axl_node[:12], forced_node)
    else:
        try:
            record = await resolve_agent_records(callee_ens)
        except Exception as exc:
            logger.error("ENS resolution failed: %s", exc)
            return NegotiationResult(success=False, error=f"ENS resolution failed: {exc}")

    timings["ens_resolve"] = time.perf_counter() - t_start
    await emit("ens_resolved", {
        "name": callee_ens,
        "axl_node": record.axl_node,
        "toll_price": record.toll_price,
        "elapsed_s": round(timings["ens_resolve"], 3),
    })
    logger.info("ENS resolved in %.2fs: axl_node=%s toll=%s %s", timings["ens_resolve"], record.axl_node, record.toll_price, record.currency)

    # --- Phase 1: Toll payment ---
    skip_toll = os.environ.get("TOLL_REQUIRED", "true").lower() in ("false", "0", "no")
    logger.info("Paying toll: %s %s to workflow %s (skip=%s)", record.toll_price, record.currency, record.workflow_id, skip_toll)
    await emit("toll_paying", {"workflow_id": record.workflow_id, "amount": record.toll_price})

    if skip_toll:
        toll_receipt = Receipt(tx_hash="0xmocked-toll", signed_receipt="mock-sig", status="confirmed")
        keeperhub = None
    else:
        keeperhub = KeeperHubClient()
    try:
        if not skip_toll:
            try:
                toll_receipt = await keeperhub.pay_workflow(TollPaymentRequest(
                    workflow_id=record.workflow_id,
                    amount=record.toll_price,
                    currency=record.currency,
                    from_wallet=caller_wallet,
                    caller_ens=caller_ens,
                ))
            except Exception as exc:
                logger.error("Toll payment failed: %s", exc)
                return NegotiationResult(success=False, error=f"Toll payment failed: {exc}")

            if not verify_receipt(toll_receipt):
                return NegotiationResult(
                    success=False,
                    error=f"Toll receipt not confirmed: status={toll_receipt.status}",
                )

        timings["toll_payment"] = time.perf_counter() - t_start - timings["ens_resolve"]
        await emit("toll_paid", {"tx_hash": toll_receipt.tx_hash, "status": toll_receipt.status, "elapsed_s": round(timings["toll_payment"], 3)})
        logger.info("Toll paid in %.2fs: tx=%s", timings["toll_payment"], toll_receipt.tx_hash)

        await asyncio.sleep(0.4)

        # --- Phase 2: AXL channel open + negotiation ---
        bridge_url = os.environ.get("ALEX_AXL_NODE", "http://127.0.0.1:9002")
        peer_peer_id = record.axl_node

        await emit("handshake_sweep")
        await asyncio.sleep(0.3)

        async with AXLSession(bridge_url=bridge_url, peer_peer_id=peer_peer_id) as session:
            # PROPOSE — carries the toll receipt so Bella can verify before accepting
            propose = ProposeMessage(
                date=booking_date,
                party_size=party_size,
                deposit_amount=max_deposit,
                toll_receipt={
                    "tx_hash": toll_receipt.tx_hash,
                    "signed_receipt": toll_receipt.signed_receipt,
                    "status": toll_receipt.status,
                },
            )
            await session.send(propose.to_dict())
            await emit("chirp", {"msg_type": "PROPOSE"})
            logger.info("AXL PROPOSE sent: date=%s party=%d deposit=%s", booking_date, party_size, max_deposit)
            await asyncio.sleep(0.5)

            # Receive response (ACCEPT, COUNTER, or REJECT)
            try:
                response = await session.receive(timeout=30.0)
            except TimeoutError:
                return NegotiationResult(success=False, error="AXL receive timed out waiting for ACCEPT")

            await emit("chirp", {"msg_type": response.get("type", "UNKNOWN")})
            logger.info("AXL response: %s", response)
            await asyncio.sleep(0.4)

            if response.get("type") == "REJECT":
                return NegotiationResult(success=False, error=f"Peer rejected: {response.get('reason', '')}", toll_receipt=toll_receipt)

            if response.get("type") not in ("ACCEPT", "COUNTER"):
                return NegotiationResult(success=False, error=f"Unexpected AXL message type: {response.get('type')}", toll_receipt=toll_receipt)

            # For COUNTER, accept the counter-offer (MVP: accept first counter)
            slot_id = response.get("slot_id", "")
            deposit = response.get("deposit_amount", max_deposit)
            terms_hash = response.get("terms_hash", "")

            # CONFIRM
            confirm = ConfirmMessage(slot_id=slot_id, signature=f"agent-sig-{session_id}")
            await session.send(confirm.to_dict())
            await emit("chirp", {"msg_type": "CONFIRM"})
            logger.info("AXL CONFIRM sent: slot=%s", slot_id)
            await asyncio.sleep(0.5)

        timings["axl_negotiation"] = time.perf_counter() - t_start - timings["ens_resolve"] - timings["toll_payment"]
        logger.info("AXL negotiation done in %.2fs", timings["axl_negotiation"])

        # --- Phase 3: Settlement ---
        logger.info("Executing settlement: slot=%s deposit=%s (skip=%s)", slot_id, deposit, skip_toll)
        await emit("settlement_executing", {"slot_id": slot_id, "deposit": deposit})

        if skip_toll:
            settlement = Receipt(tx_hash="0xmocked-settlement", signed_receipt="mock-sig", status="confirmed")
        else:
            try:
                settlement = await keeperhub.execute_workflow(
                    workflow_id=record.workflow_id.replace("inbound-toll", "booking-deposit"),
                    params={"slot_id": slot_id, "amount": deposit, "terms_hash": terms_hash},
                    audit_tag=f"tollgate-session-{session_id}",
                )
            except Exception as exc:
                logger.error("Settlement failed: %s", exc)
                return NegotiationResult(
                    success=False,
                    error=f"Settlement failed: {exc}",
                    toll_receipt=toll_receipt,
                )

        timings["settlement"] = time.perf_counter() - t_start - timings["ens_resolve"] - timings["toll_payment"] - timings["axl_negotiation"]
        timings["total"] = time.perf_counter() - t_start
        logger.info(
            "Timing: ens=%.2fs toll=%.2fs axl=%.2fs settle=%.2fs total=%.2fs",
            timings["ens_resolve"], timings["toll_payment"],
            timings["axl_negotiation"], timings["settlement"], timings["total"],
        )

        await emit("settlement_done", {"tx_hash": settlement.tx_hash})
        await emit("timing", {k: round(v, 3) for k, v in timings.items()})
        logger.info("Settlement done: tx=%s", settlement.tx_hash)
        # Final hold so the last beats finish playing before LLM speaks the confirmation
        await asyncio.sleep(0.6)

        return NegotiationResult(
            success=True,
            slot_id=slot_id,
            deposit_amount=deposit,
            terms_hash=terms_hash,
            toll_receipt=toll_receipt,
            settlement_receipt=settlement,
            timings=timings,
        )
    finally:
        if keeperhub is not None:
            await keeperhub.aclose()
