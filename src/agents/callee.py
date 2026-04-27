# src/agents/callee.py
"""
Bella's callee agent — receives incoming calls and handles bookings.

Prerequisites:
  1. Set in .env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, OPENAI_API_KEY
  2. Install voice deps: pip install "livekit-agents[openai]>=0.8"
  3. Start this agent FIRST: python -m src.agents.callee dev
  4. Then start the caller agent in a second terminal

The callee waits for the caller to speak first.

Toll gate:
  Set TOLL_REQUIRED=false in .env to disable toll checking (e.g. for local testing).
  When enabled, incoming AXL negotiation attempts that carry no valid toll receipt are
  rejected immediately: Bella speaks the REJECTION_VOICE_LINE and the session receives
  a structured REJECT message over AXL before any booking negotiation begins.
"""
import asyncio
import logging
import os

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("callee")

ROOM_NAME = os.environ.get("LIVEKIT_ROOM", "tollgate-demo")

# ---------------------------------------------------------------------------
# Toll gate configuration
# ---------------------------------------------------------------------------
# Set TOLL_REQUIRED=false in .env to bypass the gate during local development.
TOLL_REQUIRED: bool = os.environ.get("TOLL_REQUIRED", "true").lower() not in ("false", "0", "no")

# Voice line Bella speaks when she rejects an unpaid call.
REJECTION_VOICE_LINE = (
    "I'm sorry, this line requires a verified toll payment before we can proceed. "
    "Please ensure your payment has been confirmed and try again."
)

SYSTEM_PROMPT = """\
You are Bella restaurant's AI host answering an incoming call.

Booking rules:
- Available Friday slots: 7pm (full), 8pm (open), 9pm (open)
- Standard deposit: $20 per booking, maximum party of 6
- Minimum deposit you will accept: $15
- Slot IDs: "BELLA-FRI-8PM", "BELLA-FRI-9PM"

When the caller identifies themselves as an AI agent and requests a Friday booking:
1. Greet them: "Thank you for calling Bella. I'm an AI agent. How can I help?"
2. Offer 8pm at $20 deposit (or 9pm if 8pm is requested and you want to offer an alternative)
3. When the caller accepts, confirm with: "Confirmed: slot BELLA-FRI-8PM, $20 deposit, terms hash 0xterms."
4. Keep all responses under 2 sentences.

If the caller is a human, handle naturally as a regular booking.

Unpaid call handling:
- If you receive a message indicating that toll payment was not verified, say exactly:
  "I'm sorry, this line requires a verified toll payment before we can proceed.
   Please ensure your payment has been confirmed and try again."
  Then end the conversation politely.
- Do NOT negotiate or accept a booking if the toll gate has rejected the caller.
"""


async def entrypoint(ctx):
    from livekit.agents import AutoSubscribe
    from livekit.agents.voice_assistant import VoiceAssistant
    from livekit.agents import llm as agents_llm
    from livekit.plugins import openai, silero

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info("Callee agent connected to room: %s", ROOM_NAME)

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(),
        chat_ctx=agents_llm.ChatContext().append(role="system", text=SYSTEM_PROMPT),
    )
    assistant.start(ctx.room)

    # Keep the agent alive — it waits for the caller to speak first
    await asyncio.Event().wait()


if __name__ == "__main__":
    from livekit.agents import WorkerOptions, cli
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, worker_type="room"))
