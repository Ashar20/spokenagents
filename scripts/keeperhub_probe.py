"""
KeeperHub API probe.

Hits a battery of likely endpoints with the configured kh_ key and prints
status + first 200 chars of body. No money moves — only GETs.

Run: .venv/bin/python -m scripts.keeperhub_probe
"""
import asyncio
import json
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

KEY = os.environ["KEEPERHUB_API_KEY"]
BASE = os.environ.get("KEEPERHUB_BASE_URL", "https://api.keeperhub.com").rstrip("/")
H = {"Authorization": f"Bearer {KEY}", "Accept": "application/json"}

# Common candidate paths we want to probe. Order matters for readability.
CANDIDATES = [
    # account / org identity
    "/v1/me", "/me", "/v1/account", "/account", "/v1/org", "/org",
    "/api/me", "/api/account",
    # API keys
    "/v1/keys", "/api/keys",
    # workflows
    "/v1/workflows", "/workflows", "/api/workflows",
    # payments / transactions
    "/v1/payments", "/payments", "/api/payments",
    "/v1/transactions", "/transactions",
    # wallets / balances
    "/v1/wallets", "/v1/balance", "/v1/balances",
    # health / version
    "/v1/health", "/health", "/version", "/v1/version",
]


async def main() -> None:
    print(f"Base: {BASE}")
    print(f"Key:  {KEY[:8]}…{KEY[-4:]}")
    print("-" * 72)
    async with httpx.AsyncClient(headers=H, timeout=15, follow_redirects=False) as c:
        for path in CANDIDATES:
            try:
                r = await c.get(f"{BASE}{path}")
                snippet = r.text[:300].replace("\n", " ")
                tag = "✓" if r.status_code < 400 else (" " if r.status_code in (404,) else "!")
                print(f"  {tag} {r.status_code} GET  {path:25s} → {snippet}")
            except Exception as exc:
                print(f"  ✗  --- GET  {path:25s} → {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
