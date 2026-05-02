"""
Minimal Bella AXL responder for the single-agent demo.

Listens on Bella's AXL bridge for incoming PROPOSE messages from Alex and replies
with ACCEPT. Optionally publishes audio events to ws://localhost:8765 so the demo
UI can show what Bella's side sees.

Run alongside the AXL nodes:
  python -m scripts.bella_responder
"""
import asyncio
import logging
import os

from dotenv import load_dotenv

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


async def handle_propose(msg: dict) -> dict:
    date = msg.get("date", "Friday")
    party = msg.get("party_size", 4)
    deposit = msg.get("deposit_amount", "20")
    receipt = msg.get("toll_receipt", {})

    ok, reason = check_toll(receipt)
    if not ok:
        logger.warning("REJECT (toll): %s", reason)
        return RejectMessage(reason=reason).to_dict()

    logger.info("PROPOSE: date=%s party=%s deposit=%s tx=%s",
                date, party, deposit, receipt.get("tx_hash", "")[:14])
    # Cap deposit at 0.10 USDC for the demo so we don't burn the wallet on a few runs
    final_deposit = "0.10"
    return AcceptMessage(
        slot_id="BELLA-FRI-8PM",
        deposit_amount=final_deposit,
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
                logger.info("Bella sent ACCEPT: slot=%s", reply.get("slot_id"))
            elif mtype == "CONFIRM":
                logger.info("Booking confirmed by Alex: slot=%s", msg.get("slot_id"))
            else:
                logger.warning("Bella ignoring unknown message type: %s", mtype)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bella responder stopped.")
