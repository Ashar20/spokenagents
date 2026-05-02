"""
Tollgate call-control backend.

Provides HTTP endpoints for the demo UI:
  POST /api/start-call  → creates a Daily room + spawns Alex agent → returns room URL
  POST /api/end-call    → terminates the running agent + deletes the room

Run: uvicorn src.server:app --port 8080
"""
import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.ens import agent_registry
from src.ens.registrar import register_subdomain

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("call_server")

DAILY_API_KEY = os.environ.get("DAILY_API_KEY", "")
DAILY_API_BASE = "https://api.daily.co/v1"
ROOM_TTL_SECONDS = 30 * 60  # 30 min — Daily auto-deletes at this exp
SWEEP_INTERVAL_SECONDS = 60  # how often to check for orphan sessions


class CallSession(BaseModel):
    call_id: str
    room_url: str
    room_name: str


_sessions: dict[str, dict] = {}


async def _terminate_session(call_id: str, reason: str) -> None:
    """Stop the agent process and delete the Daily room for one session."""
    sess = _sessions.pop(call_id, None)
    if not sess:
        return
    logger.info("Terminating call=%s (%s)", call_id, reason)

    proc = sess.get("process")
    if proc and proc.returncode is None:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()

    try:
        await _delete_daily_room(sess["room_name"])
    except Exception as exc:
        logger.warning("Room delete failed for %s: %s", sess["room_name"], exc)


async def _sweep_stale_sessions() -> None:
    """Background loop: terminate sessions whose room exceeded TTL,
    whose Alex process exited, or whose human participant left."""
    GRACE_PERIOD_S = 90  # let user join for 90s after spawn before checking presence
    while True:
        try:
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
            now = time.time()
            for call_id, sess in list(_sessions.items()):
                age = now - sess.get("created_at", now)
                proc = sess.get("process")
                proc_dead = proc is not None and proc.returncode is not None

                if age > ROOM_TTL_SECONDS:
                    await _terminate_session(call_id, f"age={age:.0f}s exceeds 30 min TTL")
                elif proc_dead:
                    await _terminate_session(call_id, f"agent exited (code={proc.returncode})")
                elif age > GRACE_PERIOD_S:
                    if not await _room_has_human(sess["room_name"]):
                        await _terminate_session(call_id, "no human participant")
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("Sweep iteration failed: %s", exc)


async def _reconcile_orphans() -> None:
    """On startup, wipe any tollgate-* Daily rooms left over from a previous
    server process — _sessions in memory is empty, so we have no other way
    to track them and they'd otherwise sit until their TTL expires."""
    if not DAILY_API_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{DAILY_API_BASE}/rooms?limit=100",
                headers={"Authorization": f"Bearer {DAILY_API_KEY}"},
            )
        if resp.status_code >= 300:
            logger.warning("Reconcile: list rooms failed: %s", resp.status_code)
            return
        rooms = resp.json().get("data", [])
        orphans = [r["name"] for r in rooms if r["name"].startswith("tollgate-")]
        if not orphans:
            return
        logger.info("Reconcile: deleting %d orphan room(s) from previous run", len(orphans))
        for name in orphans:
            try:
                await _delete_daily_room(name)
                logger.info("  deleted orphan %s", name)
            except Exception as exc:
                logger.warning("  failed to delete %s: %s", name, exc)
    except Exception as exc:
        logger.warning("Reconcile failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DAILY_API_KEY:
        logger.warning("DAILY_API_KEY not set — /api/start-call will fail")
    await _reconcile_orphans()
    sweep_task = asyncio.create_task(_sweep_stale_sessions())
    try:
        yield
    finally:
        sweep_task.cancel()
        try:
            await sweep_task
        except asyncio.CancelledError:
            pass
        # Drain anything still alive at shutdown
        for call_id in list(_sessions.keys()):
            await _terminate_session(call_id, "server shutdown")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _create_daily_room() -> tuple[str, str]:
    name = f"tollgate-{uuid.uuid4().hex[:8]}"
    body = {
        "name": name,
        "privacy": "public",
        "properties": {
            "exp": int(time.time()) + ROOM_TTL_SECONDS,
            "enable_chat": False,
            "start_video_off": True,
        },
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{DAILY_API_BASE}/rooms",
            json=body,
            headers={"Authorization": f"Bearer {DAILY_API_KEY}"},
        )
    if resp.status_code >= 300:
        raise HTTPException(500, f"Daily room create failed: {resp.status_code} {resp.text}")
    data = resp.json()
    return data["url"], data["name"]


async def _delete_daily_room(name: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        await client.delete(
            f"{DAILY_API_BASE}/rooms/{name}",
            headers={"Authorization": f"Bearer {DAILY_API_KEY}"},
        )


async def _room_has_human(name: str) -> bool:
    """Returns True if there's at least one non-Alex participant in the room.
    Alex's userName is "Alex (Caller)" (set in DailyTransport in caller.py)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{DAILY_API_BASE}/rooms/{name}/presence",
                headers={"Authorization": f"Bearer {DAILY_API_KEY}"},
            )
        if resp.status_code == 404:
            return False
        if resp.status_code >= 300:
            return True  # don't kill on transient API errors
        data = resp.json().get("data", [])
        return any(not (p.get("userName") or "").startswith("Alex") for p in data)
    except Exception as exc:
        logger.warning("presence check failed for %s: %s", name, exc)
        return True  # err on the side of keeping the session alive


async def _spawn_alex(room_url: str, call_id: str) -> tuple[asyncio.subprocess.Process, str]:
    env = os.environ.copy()
    env["DAILY_ROOM_URL"] = room_url
    log_path = f"/tmp/alex-{call_id}.log"
    log_file = open(log_path, "w")
    proc = await asyncio.create_subprocess_exec(
        ".venv/bin/python", "-m", "src.agents.caller",
        env=env,
        stdout=log_file,
        stderr=asyncio.subprocess.STDOUT,
    )
    return proc, log_path


@app.get("/api/health")
async def health():
    return {"ok": True, "active_calls": len(_sessions)}


@app.post("/api/start-call", response_model=CallSession)
async def start_call():
    if not DAILY_API_KEY:
        raise HTTPException(500, "DAILY_API_KEY not configured on server")

    room_url, room_name = await _create_daily_room()
    logger.info("Created room: %s", room_url)

    call_id = uuid.uuid4().hex[:12]
    proc, log_path = await _spawn_alex(room_url, call_id)
    _sessions[call_id] = {
        "process": proc,
        "room_name": room_name,
        "room_url": room_url,
        "log_path": log_path,
        "created_at": time.time(),
    }
    logger.info("Spawned Alex agent (pid=%s) for call=%s, logs=%s", proc.pid, call_id, log_path)

    return CallSession(call_id=call_id, room_url=room_url, room_name=room_name)


class EndCallBody(BaseModel):
    call_id: str


@app.post("/api/end-call")
async def end_call(body: EndCallBody):
    if body.call_id not in _sessions:
        raise HTTPException(404, f"unknown call_id {body.call_id}")
    await _terminate_session(body.call_id, "client requested end")
    return {"ended": True}


# ---------- Agent registry ----------

class RegisterAgentBody(BaseModel):
    label: str = Field(..., description="Subdomain label, e.g. 'wendy' for wendy.spokenagents.eth")
    role: str = Field(..., description="caller | callee")
    axl_node: str = Field(..., description="64-char hex AXL peer id")
    axl_bridge_url: str
    wallet: str = Field(..., description="Receiving wallet (callee) or signing wallet (caller)")
    toll_price: str = ""
    currency: str = "USDC"
    workflow_id: str = ""
    capabilities: list[str] = Field(default_factory=list)
    parent_domain: str = "spokenagents.eth"


@app.post("/api/agents/register")
async def register_agent(body: RegisterAgentBody):
    """Create or update an ENS subdomain for the agent + add it to the registry.
    Idempotent: re-registering the same agent just re-applies any changed text records.
    """
    text_records = {
        "agent.role":       body.role,
        "axl.node":         body.axl_node,
        "axl.bridge_url":   body.axl_bridge_url,
        "contact.wallet":   body.wallet,
        "contact.currency": body.currency,
        "agent.version":    "tollgate/0.1",
    }
    if body.role == "callee":
        text_records["contact.price"] = body.toll_price
        text_records["contact.workflow"] = body.workflow_id
    if body.capabilities:
        import json as _json
        text_records["capabilities"] = _json.dumps(body.capabilities)

    try:
        result = await asyncio.to_thread(
            register_subdomain, body.label, text_records, parent=body.parent_domain,
        )
    except KeyError as exc:
        raise HTTPException(500, f"Server missing env var: {exc}")
    except Exception as exc:
        raise HTTPException(500, f"ENS registration failed: {exc}")

    agent_registry.add(result.ens_name)
    return {
        "ens_name": result.ens_name,
        "subnode_tx": result.subnode_tx,
        "text_record_txs": result.text_record_txs,
    }


@app.get("/api/agents")
async def list_agents(resolved: bool = Query(False, description="If true, return full ENS records")):
    """List known agents. By default returns just the ENS names; with
    ?resolved=true, fetches each one's current text records (slower)."""
    if not resolved:
        return {"agents": agent_registry.list_names()}
    entries = await agent_registry.list_resolved()
    return {"agents": [e.to_dict() for e in entries]}


@app.get("/api/agents/find")
async def find_agents(capability: str = Query(..., description="e.g. 'dining', 'booking'")):
    """Find registered agents whose ENS capabilities include the given value."""
    entries = await agent_registry.find_by_capability(capability)
    return {"capability": capability, "matches": [e.to_dict() for e in entries]}


class RegistryAddBody(BaseModel):
    ens_name: str


@app.post("/api/agents/track")
async def track_agent(body: RegistryAddBody):
    """Add an existing on-chain ENS name to the local registry without
    creating a new subdomain. Useful for tracking agents not under our parent."""
    agent_registry.add(body.ens_name)
    return {"tracked": body.ens_name}


@app.delete("/api/agents/{ens_name}")
async def untrack_agent(ens_name: str):
    """Remove an ENS name from the local registry (does NOT touch on-chain records)."""
    if not agent_registry.remove(ens_name):
        raise HTTPException(404, f"{ens_name} not in registry")
    return {"removed": ens_name}
