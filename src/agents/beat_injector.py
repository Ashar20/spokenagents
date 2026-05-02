import asyncio

from pipecat.frames.frames import OutputAudioRawFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from src.audio.beat_encoder import letter_to_frequency, synthesize_tone


class BeatInjector(FrameProcessor):
    """Pass-through FrameProcessor. Tool handlers call play_text_as_beats()
    to push one tone PER NON-WHITESPACE CHARACTER directly to the transport,
    so a string like "PROPOSE" produces 7 distinct rapid tones."""

    def __init__(
        self,
        sample_rate: int = 24000,
        tone_ms: int = 100,
        gap_ms: int = 20,
        volume: float = 0.7,
    ):
        super().__init__()
        self._sample_rate = sample_rate
        self._tone_ms = tone_ms
        self._gap_ms = gap_ms
        self._volume = volume

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)

    async def play_text_as_beats(self, text: str, direction: str = "out") -> None:
        """One OutputAudioRawFrame per character (whitespace skipped),
        awaiting tone+gap so each beat actually plays out before the next."""
        chars = [c for c in text if not c.isspace()]
        if not chars:
            return
        waveform = "sine" if direction == "out" else "square"
        wait_s = (self._tone_ms + self._gap_ms) / 1000
        for char in chars:
            freq = letter_to_frequency(char)
            audio = synthesize_tone(freq, self._tone_ms, self._sample_rate, waveform, self._volume)
            await self.push_frame(
                OutputAudioRawFrame(audio=audio, sample_rate=self._sample_rate, num_channels=1),
                FrameDirection.DOWNSTREAM,
            )
            await asyncio.sleep(wait_s)
