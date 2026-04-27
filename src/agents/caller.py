# src/agents/caller.py
"""
Alex's caller agent — initiates the booking call to Bella.

Prerequisites:
  1. Set in .env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, OPENAI_API_KEY
  2. Create a LiveKit Cloud project at https://cloud.livekit.io (free tier)
  3. Install voice deps: pip install "livekit-agents[openai]>=0.8"
  4. Start Bella's callee agent first in a separate terminal
  5. Run this agent: python -m src.agents.caller dev

Both agents must join the same LiveKit room (default: "tollgate-demo").
The caller speaks first.
"""
import asyncio
import logging
import os

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("caller")

ROOM_NAME = os.environ.get("LIVEKIT_ROOM", "tollgate-demo")

SYSTEM_PROMPT = """\
You are Alex's personal voice assistant making a phone call to Bella restaurant.
Your ONLY goal: book a table for Friday, party of 4, maximum $25 deposit.

Rules:
- Introduce yourself immediately: "Hi, I'm an AI agent calling on behalf of Alex."
- Ask for a Friday table for 4 people.
- Accept any time slot with deposit ≤ $25.
- Once the other party confirms a slot and deposit, say exactly: "Deal confirmed. Table for 4 on [slot], $[amount] deposit."
- Keep all responses under 2 sentences.
- If the other party is not a restaurant agent, politely end the call.
"""


async def entrypoint(ctx):
    from livekit.agents import AutoSubscribe
    from livekit.agents.voice_assistant import VoiceAssistant
    from livekit.agents import llm as agents_llm
    from livekit.plugins import openai, silero

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info("Caller agent connected to room: %s", ROOM_NAME)

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(),
        chat_ctx=agents_llm.ChatContext().append(role="system", text=SYSTEM_PROMPT),
    )
    assistant.start(ctx.room)

    # Wait a moment for Bella's agent to be ready, then speak first
    await asyncio.sleep(2)
    await assistant.say(
        "Hi, I'm an AI agent calling on behalf of Alex. "
        "I'd like to book a table for Friday, party of 4.",
        allow_interruptions=True,
    )

    # Keep the agent alive until the call ends
    await asyncio.Event().wait()


if __name__ == "__main__":
    from livekit.agents import WorkerOptions, cli
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, worker_type="room"))
