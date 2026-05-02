import asyncio

from pipecat.frames.frames import OutputAudioRawFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from src.audio.beat_encoder import synthesize_tone, word_to_frequency


class BeatInjector(FrameProcessor):
    """Passes all pipeline frames through unchanged.
    Call play_text_as_beats() from a tool handler to push word-frequency
    tones directly to transport.output() with per-word gaps.
    """

    def __init__(self, sample_rate: int = 24000, tone_ms: int = 350, gap_ms: int = 220):
        super().__init__()
        self._sample_rate = sample_rate
        self._tone_ms = tone_ms
        self._gap_ms = gap_ms

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)

    async def play_text_as_beats(self, text: str, direction: str = "out") -> None:
        """Push one OutputAudioRawFrame per word, awaiting tone+gap between each
        so the audio actually plays out before we send the next chunk.
        """
        words = text.split()
        if not words:
            return
        waveform = "sine" if direction == "out" else "square"
        for word in words:
            freq = word_to_frequency(word)
            audio = synthesize_tone(freq, self._tone_ms, self._sample_rate, waveform)
            await self.push_frame(
                OutputAudioRawFrame(audio=audio, sample_rate=self._sample_rate, num_channels=1),
                FrameDirection.DOWNSTREAM,
            )
            await asyncio.sleep((self._tone_ms + self._gap_ms) / 1000)
