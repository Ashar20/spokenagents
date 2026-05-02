import hashlib
import math
import struct


def word_to_frequency(word: str) -> float:
    """
    Deterministically map any word to a frequency in range 200–3800 Hz.

    Args:
        word: The word to map

    Returns:
        A frequency in Hz between 200 and 3800
    """
    h = int(hashlib.md5(word.lower().encode()).hexdigest(), 16)
    return 200 + (h % 3601)


def synthesize_tone(
    freq_hz: float,
    duration_ms: int = 200,
    sample_rate: int = 16000,
    waveform: str = "sine"
) -> bytes:
    """
    Generate raw 16-bit little-endian PCM audio (no WAV header).

    Args:
        freq_hz: Frequency in Hz
        duration_ms: Duration in milliseconds
        sample_rate: Sample rate in Hz (default 16000)
        waveform: "sine" or "square"

    Returns:
        Raw 16-bit little-endian PCM bytes
    """
    num_samples = int(sample_rate * duration_ms / 1000)
    fade_samples = int(sample_rate * 10 / 1000)  # 10 ms fade
    fade_samples = min(fade_samples, num_samples // 2)

    samples = []

    for i in range(num_samples):
        # Generate the waveform
        t = i / sample_rate
        phase = 2 * math.pi * freq_hz * t

        if waveform == "sine":
            value = math.sin(phase)
        elif waveform == "square":
            # Simple square wave: positive for first half of period, negative for second
            value = 1.0 if math.sin(phase) >= 0 else -1.0
        else:
            value = math.sin(phase)

        # Apply fade-in and fade-out
        if i < fade_samples:
            # Linear fade-in
            value *= i / fade_samples if fade_samples > 0 else 1.0
        elif i >= num_samples - fade_samples:
            # Linear fade-out
            value *= (num_samples - 1 - i) / fade_samples

        # Amplitude: multiply by 22000 for headroom
        amplitude = int(value * 22000)
        samples.append(amplitude)

    # Pack as 16-bit little-endian signed integers
    packed = struct.pack(f"<{len(samples)}h", *samples)
    return packed


def text_to_beat_audio(
    text: str,
    direction: str = "out",
    sample_rate: int = 16000,
    tone_ms: int = 200,
    gap_ms: int = 100
) -> bytes:
    """
    Convert text to beat audio by synthesizing a tone for each word.

    Args:
        text: Text to convert
        direction: "out" for sine, "in" for square waveform
        sample_rate: Sample rate in Hz
        tone_ms: Duration of each tone in milliseconds
        gap_ms: Duration of silence gap between tones in milliseconds

    Returns:
        Raw 16-bit little-endian PCM bytes concatenating all tones and gaps
    """
    # Split text on whitespace and skip empty tokens
    words = [w for w in text.split() if w]

    # Determine waveform
    waveform = "sine" if direction == "out" else "square"

    audio_chunks = []

    for word in words:
        # Get frequency for this word
        freq = word_to_frequency(word)

        # Synthesize tone
        tone_audio = synthesize_tone(freq, tone_ms, sample_rate, waveform)
        audio_chunks.append(tone_audio)

        # Add silence gap
        gap_samples = int(sample_rate * gap_ms / 1000)
        silence = b'\x00' * (gap_samples * 2)  # 2 bytes per 16-bit sample
        audio_chunks.append(silence)

    # Concatenate all chunks
    return b''.join(audio_chunks)
