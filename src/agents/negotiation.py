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
import uuid
from dataclasses import dataclass
from typing import Optional

from src.ens.resolver import AgentRecord, resolve_agent_records
from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest
from src.payments.receipt import Receipt, verify_receipt
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

    async def emit(event: str, data: Optional[dict] = None) -> None:
        logger.info("[session %s] event: %s %s", session_id, event, data or "")
        if audio_emitter:
            await audio_emitter.aemit(event, data)

    # --- Phase 0: ENS lookup ---
    logger.info("Resolving ENS: %s", callee_ens)
    await emit("ens_resolving", {"name": callee_ens})
    try:
        record: AgentRecord = await resolve_agent_records(callee_ens)
    except Exception as exc:
        logger.error("ENS resolution failed: %s", exc)
        return NegotiationResult(success=False, error=f"ENS resolution failed: {exc}")

    await emit("ens_resolved", {
        "name": callee_ens,
        "axl_node": record.axl_node,
        "toll_price": record.toll_price,
    })
    logger.info("ENS resolved: axl_node=%s toll=%s %s", record.axl_node, record.toll_price, record.currency)

    # --- Phase 1: Toll payment ---
    logger.info("Paying toll: %s %s to workflow %s", record.toll_price, record.currency, record.workflow_id)
    await emit("toll_paying", {"workflow_id": record.workflow_id, "amount": record.toll_price})

    keeperhub = KeeperHubClient()
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

    await emit("toll_paid", {"tx_hash": toll_receipt.tx_hash, "status": toll_receipt.status})
    logger.info("Toll paid: tx=%s", toll_receipt.tx_hash)

    # --- Phase 2: AXL channel open + negotiation ---
    bridge_url = os.environ.get("ALEX_AXL_NODE", "http://127.0.0.1:9002")
    peer_peer_id = record.axl_node  # axl_node field stores the peer's public key / bridge URL

    await emit("handshake_sweep")

    async with AXLSession(bridge_url=bridge_url, peer_peer_id=peer_peer_id) as session:
        # PROPOSE
        propose = ProposeMessage(date=booking_date, party_size=party_size, deposit_amount=max_deposit)
        await session.send(propose.to_dict())
        await emit("chirp", {"msg_type": "PROPOSE"})
        logger.info("AXL PROPOSE sent: date=%s party=%d deposit=%s", booking_date, party_size, max_deposit)

        # Receive response (ACCEPT, COUNTER, or REJECT)
        try:
            response = await session.receive(timeout=30.0)
        except TimeoutError:
            return NegotiationResult(success=False, error="AXL receive timed out waiting for ACCEPT")

        await emit("chirp", {"msg_type": response.get("type", "UNKNOWN")})
        logger.info("AXL response: %s", response)

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

    # --- Phase 3: Settlement ---
    logger.info("Executing settlement: slot=%s deposit=%s", slot_id, deposit)
    await emit("settlement_executing", {"slot_id": slot_id, "deposit": deposit})

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

    await emit("settlement_done", {"tx_hash": settlement.tx_hash})
    logger.info("Settlement done: tx=%s", settlement.tx_hash)

    await keeperhub.aclose()

    return NegotiationResult(
        success=True,
        slot_id=slot_id,
        deposit_amount=deposit,
        terms_hash=terms_hash,
        toll_receipt=toll_receipt,
        settlement_receipt=settlement,
    )
