#!/usr/bin/env python3
"""
ENS name registration helper for Tollgate.

Usage:
    python scripts/register_ens.py           # print planned records
    python scripts/register_ens.py verify    # resolve records from chain and print

Registration itself (setting text records on Base Sepolia) can be done via:
  A) ENS app:  https://app.ens.domains — search your name, Edit Records
  B) ensjs CLI: npx --yes @ensdomains/ensjs set-text <name> <key> <value> --chain sepolia
  C) web3.py:  see _set_text_web3() below (experimental, may not work on all chains)

Run this script first to see the exact records to set, then use option A, B, or C.
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

def _build_records() -> dict[str, dict[str, str]]:
    return {
        os.environ.get("ALEX_ENS", "alex-tollgate.eth"): {
            "axl.node": os.environ.get("ALEX_AXL_NODE", "PLACEHOLDER — set after Task 5"),
            "contact.price": "0",
            "contact.currency": "USDC",
            "contact.workflow": "alex/inbound-toll",
            "capabilities": '["call"]',
            "agent.version": "tollgate/0.1",
        },
        os.environ.get("BELLA_ENS", "bella-tollgate.eth"): {
            "axl.node": os.environ.get("BELLA_AXL_NODE", "PLACEHOLDER — set after Task 5"),
            "contact.price": "0.25",
            "contact.currency": "USDC",
            "contact.workflow": os.environ.get("BELLA_TOLL_WORKFLOW", "bella/inbound-toll"),
            "capabilities": '["booking","quotes"]',
            "agent.version": "tollgate/0.1",
        },
    }


def print_planned_records() -> None:
    records = _build_records()
    print("\n=== Tollgate ENS Records to Set ===\n")
    for name, text_records in records.items():
        print(f"  {name}")
        for key, value in text_records.items():
            print(f"    {key} = {value}")
        print()
    print("To set these records, use one of:")
    print("  A) https://app.ens.domains (GUI)")
    print("  B) npx @ensdomains/ensjs set-text <name> <key> <value>")
    print("  C) python scripts/register_ens.py set  (calls _set_text_web3 below)")
    print()


async def verify_records() -> None:
    from src.ens.resolver import resolve_agent_records

    rpc_url = os.environ.get("RPC_URL", "https://sepolia.base.org")
    names = [
        os.environ.get("ALEX_ENS", "alex-tollgate.eth"),
        os.environ.get("BELLA_ENS", "bella-tollgate.eth"),
    ]
    print("\n=== Verifying ENS Records from Chain ===\n")
    for name in names:
        print(f"  Resolving {name} ...")
        try:
            record = await resolve_agent_records(name, rpc_url=rpc_url)
            print(f"    axl_node      = {record.axl_node!r}")
            print(f"    toll_price    = {record.toll_price!r}")
            print(f"    workflow_id   = {record.workflow_id!r}")
            print(f"    capabilities  = {record.capabilities!r}")
        except Exception as exc:
            print(f"    ERROR: {exc}")
        print()


async def _set_text_web3(ens_name: str, key: str, value: str) -> None:
    """
    Experimental: set an ENS text record via web3.py.
    May not work on Base Sepolia depending on ENS deployment.
    Use ensjs CLI or ENS app as fallback.
    """
    from web3 import AsyncWeb3

    rpc_url = os.environ.get("RPC_URL", "https://sepolia.base.org")
    private_key = os.environ.get("ALEX_WALLET_PRIVATE_KEY") or os.environ.get("BELLA_WALLET_PRIVATE_KEY")
    if not private_key:
        print("  No wallet private key in env — skipping web3 set")
        return

    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(rpc_url))
    account = w3.eth.account.from_key(private_key)
    print(f"  web3 set {ens_name} {key}={value!r} from {account.address}")
    # ENS PublicResolver setText ABI — adapt address to your chain
    print("  NOTE: web3.py ENS settext not fully wired — use ensjs CLI instead")


async def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if cmd == "verify":
        await verify_records()
    elif cmd == "set":
        records = _build_records()
        for name, text_records in records.items():
            for key, value in text_records.items():
                await _set_text_web3(name, key, value)
    else:
        print_planned_records()


if __name__ == "__main__":
    asyncio.run(main())
