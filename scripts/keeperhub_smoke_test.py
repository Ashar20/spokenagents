#!/usr/bin/env python3
"""
KeeperHub live smoke test — requires KEEPERHUB_API_KEY in .env.

Usage: python scripts/keeperhub_smoke_test.py

This makes a REAL API call to KeeperHub. Use a test/staging workflow_id.
Set KEEPERHUB_BASE_URL to a sandbox URL if available.
"""
import asyncio
import os
import sys
import logging

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("keeperhub_smoke")


async def main() -> None:
    api_key = os.environ.get("KEEPERHUB_API_KEY")
    if not api_key:
        logger.error("KEEPERHUB_API_KEY not set in .env — skipping live smoke test")
        logger.info("To run: add KEEPERHUB_API_KEY to .env and retry")
        sys.exit(0)  # exit 0 — not a failure, just unconfigured

    from src.payments.keeperhub import KeeperHubClient, TollPaymentRequest

    client = KeeperHubClient()
    logger.info("Sending toll payment to KeeperHub...")

    receipt = await client.pay_workflow(TollPaymentRequest(
        workflow_id=os.environ.get("BELLA_TOLL_WORKFLOW", "bella/inbound-toll"),
        amount="0.01",
        currency="USDC",
        from_wallet=os.environ.get("ALEX_WALLET_ADDRESS", "0xPlaceholder"),
        caller_ens=os.environ.get("ALEX_ENS", "alex-tollgate.eth"),
    ))

    logger.info("Receipt: %s", receipt)

    if receipt.status == "confirmed":
        logger.info("=== KeeperHub smoke test PASSED ===")
    else:
        logger.warning("Status was %r (not 'confirmed') — check KeeperHub docs for correct workflow_id", receipt.status)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
