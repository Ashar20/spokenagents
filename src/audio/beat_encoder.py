import hashlib
import math
import struct


def word_to_frequency(word: str) -> float:
    """Deterministic word → frequency in 200–3800 Hz (legacy per-word mode)."""
    h = int(hashlib.md5(word.lower().encode()).hexdigest(), 16)
    return 200 + (h % 3601)


def letter_to_frequency(letter: str) -> float:
    """Deterministic single-character → frequency in 200–3800 Hz.

    Same hash family as word_to_frequency but seeded with a different prefix
    so an "h" tone doesn't collide with the word "h". Case-insensitive.
    """
    h = int(hashlib.md5(("ltr:" + letter.lower()).encode()).hexdigest(), 16)
    return 200 + (h % 3601)


def synthesize_tone(
    freq_hz: float,
    duration_ms: int = 200,
    sample_rate: int = 16000,
    waveform: str = "sine",
    volume: float = 0.7,
) -> bytes:
    """Generate raw 16-bit little-endian PCM audio (no WAV header).

    volume is 0.0–1.0 of full int16 scale. 0.7 = 70% (~22937/32767).
    """
    num_samples = int(sample_rate * duration_ms / 1000)
    fade_samples = min(int(sample_rate * 10 / 1000), num_samples // 2)
    peak = int(32767 * max(0.0, min(volume, 1.0)))

    samples = []

    for i in range(num_samples):
        t = i / sample_rate
        phase = 2 * math.pi * freq_hz * t

        if waveform == "sine":
            value = math.sin(phase)
        elif waveform == "square":
            value = 1.0 if math.sin(phase) >= 0 else -1.0
        else:
            value = math.sin(phase)

        # Linear fade-in / fade-out over the first/last 10ms
        if i < fade_samples:
            value *= i / fade_samples if fade_samples > 0 else 1.0
        elif i >= num_samples - fade_samples:
            value *= (num_samples - 1 - i) / fade_samples

        samples.append(int(value * peak))

    return struct.pack(f"<{len(samples)}h", *samples)


def text_to_beat_audio(
    text: str,
    direction: str = "out",
    sample_rate: int = 16000,
    tone_ms: int = 100,
    gap_ms: int = 20,
    mode: str = "letter",
    volume: float = 0.7,
) -> bytes:
    """Concatenate per-token tones into raw PCM.

    mode="letter" (default): one tone per non-whitespace character (~150 ms each).
    mode="word":             one tone per whitespace-separated word (legacy).
    Whitespace is skipped — there is no audible silence for spaces; the
    inter-tone gap_ms already provides separation.
    """
    if mode == "word":
        tokens = [w for w in text.split() if w]
        freq_fn = word_to_frequency
    else:
        tokens = [c for c in text if not c.isspace()]
        freq_fn = letter_to_frequency

    waveform = "sine" if direction == "out" else "square"
    gap_bytes = b"\x00" * (int(sample_rate * gap_ms / 1000) * 2)

    chunks: list[bytes] = []
    for token in tokens:
        chunks.append(synthesize_tone(freq_fn(token), tone_ms, sample_rate, waveform, volume))
        chunks.append(gap_bytes)
    return b"".join(chunks)
