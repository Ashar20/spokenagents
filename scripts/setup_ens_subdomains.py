"""
Create alex.spokenagents.eth and bella.spokenagents.eth on Sepolia ENS,
then write the agent text records to each. Signed locally with the
spokenagents.eth owner key — bypasses KeeperHub's value-stripping bug.

Run:
  .venv/bin/python -m scripts.setup_ens_subdomains

Requires in .env:
  SPOKENAGENTS_OWNER_KEY     private key of spokenagents.eth owner
  RPC_URL                    Sepolia RPC
  TOLLGATE_WORKFLOW_ID       (optional) for bella's contact.workflow record
  BELLA_WALLET_ADDRESS       bella's receive wallet
"""
import logging
import os

from dotenv import load_dotenv
from eth_account import Account
from eth_utils import keccak
from web3 import Web3

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("setup_ens")

# ---------- Sepolia ENS contracts ----------
ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD"

PARENT = "spokenagents.eth"
PRIV_KEY = os.environ["SPOKENAGENTS_OWNER_KEY"]
ACCT = Account.from_key(PRIV_KEY)

ALEX_PEER = "1fc5fc5c98ee3b8291abdaf942ad1c1b57cc611e7bd3ad80e7b8c7b833891763"
BELLA_PEER = "ba83aeb4556aacf342914cca2bfe3876386310c46d1bcade052bb86d0e983bfc"
BELLA_WALLET = os.environ["BELLA_WALLET_ADDRESS"]
TOLLGATE_WORKFLOW_ID = os.environ.get("TOLLGATE_WORKFLOW_ID", "")
# Alex's wallet for the demo is the KeeperHub-managed wallet
ALEX_WALLET = os.environ.get("CALLER_WALLET", "0x30b748f458ab37957d0b6a291e6d64dff10f94a3")

SUBDOMAINS: dict[str, dict[str, str]] = {
    "alex": {
        "agent.role":       "caller",
        "axl.node":         ALEX_PEER,
        "axl.bridge_url":   "http://127.0.0.1:9102",
        "contact.wallet":   Web3.to_checksum_address(ALEX_WALLET),
        "contact.currency": "USDC",
        "capabilities":     '["voice","ordering"]',
        "agent.version":    "tollgate/0.1",
    },
    "bella": {
        "agent.role":       "callee",
        "axl.node":         BELLA_PEER,
        "axl.bridge_url":   "http://127.0.0.1:9112",
        "contact.wallet":   Web3.to_checksum_address(BELLA_WALLET),
        "contact.price":    "0.05",
        "contact.currency": "USDC",
        "contact.workflow": TOLLGATE_WORKFLOW_ID,
        "capabilities":     '["dining","booking"]',
        "agent.version":    "tollgate/0.1",
    },
}


def namehash(name: str) -> bytes:
    node = b"\x00" * 32
    for label in reversed(name.split(".")):
        node = keccak(node + keccak(label.encode()))
    return node


# Slim ABIs
REGISTRY_ABI = [{
    "inputs": [
        {"name": "node", "type": "bytes32"},
        {"name": "label", "type": "bytes32"},
        {"name": "owner", "type": "address"},
        {"name": "resolver", "type": "address"},
        {"name": "ttl", "type": "uint64"},
    ],
    "name": "setSubnodeRecord",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function",
}, {
    "inputs": [{"name": "node", "type": "bytes32"}],
    "name": "owner",
    "outputs": [{"type": "address"}],
    "stateMutability": "view",
    "type": "function",
}, {
    "inputs": [{"name": "node", "type": "bytes32"}],
    "name": "resolver",
    "outputs": [{"type": "address"}],
    "stateMutability": "view",
    "type": "function",
}]

RESOLVER_ABI = [{
    "inputs": [
        {"name": "node", "type": "bytes32"},
        {"name": "key", "type": "string"},
        {"name": "value", "type": "string"},
    ],
    "name": "setText",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function",
}, {
    "inputs": [
        {"name": "node", "type": "bytes32"},
        {"name": "key", "type": "string"},
    ],
    "name": "text",
    "outputs": [{"type": "string"}],
    "stateMutability": "view",
    "type": "function",
}]


def send_tx(w3: Web3, contract, fn_name: str, args: list, label: str) -> str:
    """Re-fetch nonce per call so a prior timeout/revert doesn't desync us.
    `pending` mode skips already-submitted-but-unconfirmed txs.
    Estimates gas with 20% buffer and uses live gas price.
    """
    fn = contract.functions[fn_name](*args)
    nonce = w3.eth.get_transaction_count(ACCT.address, "pending")
    estimated = fn.estimate_gas({"from": ACCT.address})
    gas_price = w3.eth.gas_price
    tx = fn.build_transaction({
        "from": ACCT.address,
        "nonce": nonce,
        "chainId": w3.eth.chain_id,
        "maxFeePerGas": int(gas_price * 2),
        "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
        "gas": int(estimated * 1.2),
    })
    signed = ACCT.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    logger.info("  %s sent: %s (nonce=%d, gas=%d)", label, h.hex(), nonce, tx["gas"])
    receipt = w3.eth.wait_for_transaction_receipt(h, timeout=180)
    if receipt.status != 1:
        raise RuntimeError(f"{label} reverted: {receipt}")
    logger.info("  %s confirmed in block %s", label, receipt.blockNumber)
    return h.hex()


def main():
    w3 = Web3(Web3.HTTPProvider(os.environ.get("RPC_URL", "https://ethereum-sepolia.publicnode.com")))
    logger.info("Connected to chain %s as %s", w3.eth.chain_id, ACCT.address)
    logger.info("ETH balance: %s", w3.eth.get_balance(ACCT.address) / 1e18)

    parent_node = namehash(PARENT)
    logger.info("Parent: %s  namehash=0x%s", PARENT, parent_node.hex())

    registry = w3.eth.contract(address=Web3.to_checksum_address(ENS_REGISTRY), abi=REGISTRY_ABI)
    resolver = w3.eth.contract(address=Web3.to_checksum_address(PUBLIC_RESOLVER), abi=RESOLVER_ABI)

    # Step 1 — create subdomains via setSubnodeRecord
    logger.info("\n--- Creating subdomains ---")
    for label in SUBDOMAINS:
        full = f"{label}.{PARENT}"
        sub_node = namehash(full)
        existing_owner = registry.functions.owner(sub_node).call()
        if existing_owner == ACCT.address:
            logger.info("  %s already owned by us, skipping setSubnodeRecord", full)
            continue
        if existing_owner != "0x0000000000000000000000000000000000000000":
            logger.info("  %s owned by %s — overwriting", full, existing_owner)
        send_tx(
            w3, registry, "setSubnodeRecord",
            [parent_node, keccak(label.encode()), ACCT.address,
             Web3.to_checksum_address(PUBLIC_RESOLVER), 0],
            label=f"setSubnodeRecord({full})",
        )

    # Step 2 — set text records (idempotent: skip if already set to same value)
    logger.info("\n--- Setting text records ---")
    for label, records in SUBDOMAINS.items():
        full = f"{label}.{PARENT}"
        sub_node = namehash(full)
        logger.info("  %s:", full)
        for key, value in records.items():
            if not value:
                continue
            current = resolver.functions.text(sub_node, key).call()
            if current == value:
                logger.info("    %s already set to %r, skipping", key, value)
                continue
            send_tx(
                w3, resolver, "setText",
                [sub_node, key, value],
                label=f"setText({label}.{key})",
            )

    # Step 3 — verify
    logger.info("\n--- Verifying ---")
    for label, records in SUBDOMAINS.items():
        full = f"{label}.{PARENT}"
        sub_node = namehash(full)
        logger.info("  %s:", full)
        for key in records:
            val = resolver.functions.text(sub_node, key).call()
            logger.info("    %-22s = %s", key, val)


if __name__ == "__main__":
    main()
