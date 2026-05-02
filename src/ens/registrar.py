"""
Programmatic ENS subdomain registrar.

Used by both `scripts/setup_ens_subdomains.py` (CLI bootstrap) and the
`/api/agents/register` HTTP route (live registration). Uses the
spokenagents.eth owner key from SPOKENAGENTS_OWNER_KEY to sign txs.
"""
import logging
import os
from dataclasses import dataclass

from eth_account import Account
from eth_utils import keccak
from web3 import Web3

logger = logging.getLogger(__name__)

ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD"

_REGISTRY_ABI = [{
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
}]

_RESOLVER_ABI = [{
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


@dataclass
class RegistrationResult:
    ens_name: str
    subnode_tx: str | None       # None if subdomain already owned
    text_record_txs: dict[str, str]  # key → tx hash (only for newly-set records)


def namehash(name: str) -> bytes:
    node = b"\x00" * 32
    for label in reversed(name.split(".")):
        node = keccak(node + keccak(label.encode()))
    return node


def _send_tx(w3: Web3, account, contract, fn_name: str, args: list, label: str) -> str:
    fn = contract.functions[fn_name](*args)
    nonce = w3.eth.get_transaction_count(account.address, "pending")
    estimated = fn.estimate_gas({"from": account.address})
    # Ensure maxFeePerGas >= maxPriorityFeePerGas (Sepolia base fee can be tiny)
    priority_wei = w3.to_wei(2, "gwei")
    max_fee_wei = max(int(w3.eth.gas_price * 2) + priority_wei, priority_wei * 2)
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": w3.eth.chain_id,
        "maxFeePerGas": max_fee_wei,
        "maxPriorityFeePerGas": priority_wei,
        "gas": int(estimated * 1.2),
    })
    signed = account.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    logger.info("%s sent: %s (nonce=%d)", label, h.hex(), nonce)
    receipt = w3.eth.wait_for_transaction_receipt(h, timeout=180)
    if receipt.status != 1:
        raise RuntimeError(f"{label} reverted: {receipt}")
    return h.hex()


def register_subdomain(
    label: str,
    text_records: dict[str, str],
    *,
    parent: str = "spokenagents.eth",
    rpc_url: str | None = None,
    owner_key: str | None = None,
) -> RegistrationResult:
    """Create or update an ENS subdomain `<label>.<parent>` with the given text records.

    Idempotent: skips setSubnodeRecord if the subdomain already belongs to us,
    and skips setText for keys whose current on-chain value matches.
    """
    rpc_url = rpc_url or os.environ.get("RPC_URL", "https://ethereum-sepolia.publicnode.com")
    owner_key = owner_key or os.environ["SPOKENAGENTS_OWNER_KEY"]
    account = Account.from_key(owner_key)

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    parent_node = namehash(parent)
    full_name = f"{label}.{parent}"
    sub_node = namehash(full_name)

    registry = w3.eth.contract(address=Web3.to_checksum_address(ENS_REGISTRY), abi=_REGISTRY_ABI)
    resolver = w3.eth.contract(address=Web3.to_checksum_address(PUBLIC_RESOLVER), abi=_RESOLVER_ABI)

    # Step 1: create the subnode if we don't already own it
    subnode_tx: str | None = None
    existing_owner = registry.functions.owner(sub_node).call()
    if existing_owner != account.address:
        subnode_tx = _send_tx(
            w3, account, registry, "setSubnodeRecord",
            [parent_node, keccak(label.encode()), account.address,
             Web3.to_checksum_address(PUBLIC_RESOLVER), 0],
            f"setSubnodeRecord({full_name})",
        )

    # Step 2: set each text record (idempotent)
    text_record_txs: dict[str, str] = {}
    for key, value in text_records.items():
        if not value:
            continue
        current = resolver.functions.text(sub_node, key).call()
        if current == value:
            continue
        text_record_txs[key] = _send_tx(
            w3, account, resolver, "setText",
            [sub_node, key, value],
            f"setText({full_name}.{key})",
        )

    return RegistrationResult(
        ens_name=full_name,
        subnode_tx=subnode_tx,
        text_record_txs=text_record_txs,
    )
