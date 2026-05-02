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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("call_server")

DAILY_API_KEY = os.environ.get("DAILY_API_KEY", "")
DAILY_API_BASE = "https://api.daily.co/v1"
ROOM_TTL_SECONDS = 60 * 60  # 1 hour


class CallSession(BaseModel):
    call_id: str
    room_url: str
    room_name: str


_sessions: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DAILY_API_KEY:
        logger.warning("DAILY_API_KEY not set — /api/start-call will fail")
    yield
    for call_id, sess in list(_sessions.items()):
        proc = sess.get("process")
        if proc and proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                proc.kill()


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
    }
    logger.info("Spawned Alex agent (pid=%s) for call=%s, logs=%s", proc.pid, call_id, log_path)

    return CallSession(call_id=call_id, room_url=room_url, room_name=room_name)


class EndCallBody(BaseModel):
    call_id: str


@app.post("/api/end-call")
async def end_call(body: EndCallBody):
    sess = _sessions.pop(body.call_id, None)
    if not sess:
        raise HTTPException(404, f"unknown call_id {body.call_id}")

    proc = sess.get("process")
    if proc and proc.returncode is None:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()
        logger.info("Terminated Alex agent for call=%s", body.call_id)

    try:
        await _delete_daily_room(sess["room_name"])
        logger.info("Deleted room %s", sess["room_name"])
    except Exception as exc:
        logger.warning("Room delete failed: %s", exc)

    return {"ended": True}
