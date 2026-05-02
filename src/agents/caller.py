# src/agents/caller.py
"""
Alex's caller agent — Pipecat STT→Gemini→TTS pipeline with AXL beat sonification.

Prerequisites:
  Set in .env:
    DAILY_ROOM_URL       - Daily.co room URL
    DAILY_TOKEN          - Daily meeting token (optional for dev)
    DEEPGRAM_API_KEY     - Deepgram STT
    GOOGLE_API_KEY       - Google AI Studio (Gemini LLM + Cloud TTS)
    ALEX_AXL_NODE        - AXL bridge URL (default http://127.0.0.1:9002)
    RPC_URL              - Ethereum RPC for ENS lookup
    CALLER_WALLET        - Alex's wallet address
    CALLER_ENS           - Alex's ENS name (e.g. alex.eth)

Flow:
  1. User speaks intent ("order food from Bella")
  2. Gemini LLM calls the place_order tool
  3. Tool runs ENS lookup → toll → AXL negotiation
  4. Each AXL message is sonified as frequency beats over Daily
  5. LLM speaks the booking confirmation
"""
import asyncio
import logging
import os

from dotenv import dotenv_values, load_dotenv

# Override stale parent-env vars (e.g. uvicorn's cached BELLA_ENS) with the
# freshest .env — but only for keys that have a non-empty value in .env, so
# that runtime-injected vars like DAILY_ROOM_URL (set per call by src/server.py)
# don't get clobbered by a blank slot.
load_dotenv()  # first pass: only fill missing
for k, v in dotenv_values().items():
    if v:
        os.environ[k] = v
logger = logging.getLogger("caller")

SYSTEM_PROMPT = """\
You are Alex's personal AI phone agent. Your job is to help Alex order food or make reservations.

When the user asks you to order food from Bella (or any similar request), immediately call the
place_order tool with:
  - date: the requested date (default "Friday" if not specified)
  - party_size: number of people (default 4 if not specified)
  - max_deposit: maximum deposit Alex will pay in USD (default "25")

While the order tool runs, the user hears live status narration AND machine beats — do NOT describe
what is happening. When the tool returns, give a single short confirmation like "All set." or
"Booked." — do NOT restate the slot ID, deposit amount, or terms; the user already heard them.

Keep replies to a single short sentence.
"""

OPENING_LINE = "Hi, I'm Alex's agent. How can I help you today?"


async def main() -> None:
    from pipecat.audio.vad.silero import SileroVADAnalyzer
    from pipecat.frames.frames import TTSSpeakFrame
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineParams, PipelineTask
    from pipecat.adapters.schemas.function_schema import FunctionSchema
    from pipecat.adapters.schemas.tools_schema import ToolsSchema
    from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
    from pipecat.services.deepgram.stt import DeepgramSTTService
    from pipecat.services.deepgram.tts import DeepgramTTSService
    from pipecat.services.google.llm import GoogleLLMService
    from pipecat.transports.services.daily import DailyParams, DailyTransport

    from src.agents.beat_injector import BeatInjector
    from src.agents.negotiation import run_negotiation
    from src.audio.events import AudioEventEmitter

    # --- Transport ---
    transport = DailyTransport(
        os.environ["DAILY_ROOM_URL"],
        os.environ.get("DAILY_TOKEN"),
        "Alex (Caller)",
        DailyParams(
            audio_out_enabled=True,
            audio_in_enabled=True,
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
            vad_audio_passthrough=True,
        ),
    )

    # --- STT / LLM / TTS ---
    stt = DeepgramSTTService(api_key=os.environ["DEEPGRAM_API_KEY"])

    llm = GoogleLLMService(
        model="gemini-2.0-flash",
        api_key=os.environ["GOOGLE_API_KEY"],
    )

    tts = DeepgramTTSService(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        voice="aura-asteria-en",
    )

    # Per-letter mode (defaults: 24kHz, 150ms tone, 30ms gap → ~5.5 tones/sec).
    # E.g. "PROPOSE" = 7 distinct rapid tones instead of one chunky word-tone.
    beat_injector = BeatInjector()

    # --- LLM context + tool definition ---
    place_order_tool = FunctionSchema(
        name="place_order",
        description=(
            "Place a food order or table reservation with a restaurant agent "
            "by resolving its ENS name, paying toll, and negotiating via AXL."
        ),
        properties={
            "date":        {"type": "string",  "description": "Booking date, e.g. 'Friday'"},
            "party_size":  {"type": "integer", "description": "Number of people"},
            "max_deposit": {"type": "string",  "description": "Max deposit in USD, e.g. '25'"},
        },
        required=["date", "party_size", "max_deposit"],
    )
    tools = ToolsSchema(standard_tools=[place_order_tool])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    context = OpenAILLMContext(messages, tools=tools)
    context_aggregator = llm.create_context_aggregator(context)

    # Spoken status (TTSSpeakFrame). Empty/missing = beats only.
    _NARRATION = {
        "ens_resolving":         "Looking up the agent's address.",
        "toll_paying":           "Paying the toll on chain.",
        "handshake_sweep":       "Connecting to the agent.",
        "settlement_executing":  "Sending the deposit.",
        "settlement_done":       "Booking confirmed.",
    }

    def _beat_phrase(event: str, data: dict) -> tuple[str, str]:
        """Build the data-rich beat phrase + waveform direction for an event.
        Each non-whitespace char becomes a 100 ms tone, so e.g. a 14-char
        tx-hash prefix plays as ~1.7 s of distinct frequencies."""
        d = data or {}
        if event == "ens_resolving":
            return f"resolve {d.get('name', '')}", "out"
        if event == "ens_resolved":
            return f"found {d.get('wallet', '')[:14]}", "in"
        if event == "toll_paying":
            return f"pay {d.get('amount', '0')} usdc", "out"
        if event == "toll_paid":
            return f"toll tx {d.get('tx_hash', '')[:18]}", "in"
        if event == "handshake_sweep":
            return "axl handshake", "out"
        if event == "chirp":
            msg_type = d.get("msg_type", "msg")
            direction = "in" if msg_type in ("ACCEPT", "COUNTER") else "out"
            return msg_type.lower(), direction
        if event == "settlement_executing":
            return f"settle {d.get('deposit', '0')} usdc", "out"
        if event == "settlement_done":
            return f"settled tx {d.get('tx_hash', '')[:18]}", "in"
        return "", "out"

    class _BeatAudioEmitter:
        """Bridges negotiation events to live audio + the trace WS for the canvas."""
        def __init__(self, injector: BeatInjector, task: PipelineTask, ws: AudioEventEmitter | None):
            self._injector = injector
            self._task = task
            self._ws = ws

        async def aemit(self, event: str, data=None) -> None:
            data = data or {}
            if self._ws:
                try:
                    await self._ws.aemit(event, data)
                except Exception as exc:
                    logger.debug("trace WS emit failed: %s", exc)
            narration = _NARRATION.get(event)
            if narration:
                await self._task.queue_frames([TTSSpeakFrame(narration)])
            phrase, direction = _beat_phrase(event, data)
            if phrase:
                await self._injector.play_text_as_beats(phrase, direction=direction)

    # --- Tool handler ---
    async def handle_place_order(
        function_name, tool_call_id, arguments, llm, context, result_callback
    ):
        date        = arguments.get("date", "Friday")
        party_size  = int(arguments.get("party_size", 4))
        max_deposit = str(arguments.get("max_deposit", "25"))

        logger.info("place_order tool: date=%s party=%d deposit=%s", date, party_size, max_deposit)

        caller_wallet = os.environ.get("CALLER_WALLET")
        if not caller_wallet:
            await result_callback({"error": "CALLER_WALLET env var required"})
            return

        callee_ens = os.environ.get("BELLA_ENS", "bella.spokenagents.eth")
        caller_ens = os.environ.get("ALEX_ENS", "alex.spokenagents.eth")
        logger.info("place_order resolved to: caller_ens=%s callee_ens=%s wallet=%s",
                    caller_ens, callee_ens, caller_wallet)

        ws_emitter = AudioEventEmitter(os.environ.get("TRACE_WS_URL", "ws://localhost:8765"))
        try:
            await ws_emitter.connect()
        except Exception as exc:
            logger.warning("trace WS connect failed (canvas won't animate): %s", exc)
            ws_emitter = None

        emitter = _BeatAudioEmitter(beat_injector, task, ws_emitter)
        result = await run_negotiation(
            callee_ens=callee_ens,
            booking_date=date,
            party_size=party_size,
            max_deposit=max_deposit,
            caller_wallet=caller_wallet,
            caller_ens=caller_ens,
            audio_emitter=emitter,
        )

        if ws_emitter:
            try:
                await ws_emitter.close()
            except Exception:
                pass

        if not result.success:
            await result_callback({"error": result.error})
            return

        await result_callback({
            "slot_id":        result.slot_id,
            "deposit_amount": result.deposit_amount,
            "terms_hash":     result.terms_hash,
        })

    llm.register_function("place_order", handle_place_order)

    # --- Pipeline ---
    pipeline = Pipeline([
        transport.input(),
        stt,
        context_aggregator.user(),
        llm,
        tts,
        beat_injector,
        transport.output(),
        context_aggregator.assistant(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        await transport.capture_participant_audio(participant["id"])
        await asyncio.sleep(1)
        await task.queue_frames([TTSSpeakFrame(OPENING_LINE)])

    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    asyncio.run(main())
