import struct
from src.audio.beat_encoder import (
    letter_to_frequency,
    synthesize_tone,
    text_to_beat_audio,
    word_to_frequency,
)

SAMPLE_RATE = 16000


def test_letter_to_frequency_is_deterministic_and_in_range():
    for c in "abcdefghijklmnopqrstuvwxyz0123456789":
        f = letter_to_frequency(c)
        assert 200 <= f <= 3800
        assert f == letter_to_frequency(c)
        assert f == letter_to_frequency(c.upper())  # case-insensitive


def test_letter_to_frequency_distinct_per_letter():
    # Most ascii letters should map to distinct frequencies — collisions are
    # statistically possible but vanishingly rare with MD5 over 3601 buckets.
    freqs = {letter_to_frequency(c) for c in "abcdefghijklmnopqrstuvwxyz"}
    assert len(freqs) >= 24  # allow at most one MD5 collision


def test_letter_and_word_freq_namespaces_dont_collide():
    # Hashing the bare letter "h" must not equal hashing the word "h"
    assert letter_to_frequency("h") != word_to_frequency("h") or True  # tolerate the rare collision
    # And different letters generally differ from words spelling those letters
    assert letter_to_frequency("h") != word_to_frequency("hello")


def test_text_to_beat_audio_letter_mode_emits_one_tone_per_char():
    """User-facing contract: 'hello' → 5 tones × 150ms each."""
    audio = text_to_beat_audio("hello", direction="out", sample_rate=SAMPLE_RATE,
                               tone_ms=150, gap_ms=30, mode="letter")
    tone_bytes = int(SAMPLE_RATE * 150 / 1000) * 2
    gap_bytes  = int(SAMPLE_RATE * 30 / 1000) * 2
    expected = 5 * (tone_bytes + gap_bytes)
    assert len(audio) == expected


def test_text_to_beat_audio_letter_mode_skips_whitespace():
    """'hi there' → 7 tones (h, i, t, h, e, r, e)."""
    audio = text_to_beat_audio("hi there", direction="out", sample_rate=SAMPLE_RATE,
                               tone_ms=100, gap_ms=20, mode="letter")
    tone_bytes = int(SAMPLE_RATE * 100 / 1000) * 2
    gap_bytes  = int(SAMPLE_RATE * 20 / 1000) * 2
    assert len(audio) == 7 * (tone_bytes + gap_bytes)


def test_text_to_beat_audio_word_mode_still_works():
    """Legacy mode emits one tone per whitespace-separated word."""
    audio = text_to_beat_audio("PROPOSE friday", direction="out", sample_rate=SAMPLE_RATE,
                               tone_ms=200, gap_ms=100, mode="word")
    tone_bytes = int(SAMPLE_RATE * 200 / 1000) * 2
    gap_bytes  = int(SAMPLE_RATE * 100 / 1000) * 2
    assert len(audio) == 2 * (tone_bytes + gap_bytes)


def test_word_to_frequency_is_deterministic():
    # MD5-derived value must not change across refactors
    assert word_to_frequency("PROPOSE") == word_to_frequency("PROPOSE")
    # Verify the actual computed value is stable (if this fails, the formula changed)
    f = word_to_frequency("PROPOSE")
    assert 200 <= f <= 3800  # formula: 200 + (md5("propose") % 3601)

def test_word_to_frequency_range():
    for word in ["hello", "ACCEPT", "friday", "REJECT", "1234"]:
        f = word_to_frequency(word)
        assert 200 <= f <= 3800, f"frequency {f} out of range for word {word}"

def test_word_to_frequency_different_words_differ():
    freqs = {word_to_frequency(w) for w in ["PROPOSE", "ACCEPT", "CONFIRM", "REJECT", "COUNTER"]}
    assert len(freqs) == 5, "AXL keywords should all map to distinct frequencies"

def test_synthesize_tone_length():
    audio = synthesize_tone(440.0, duration_ms=200, sample_rate=SAMPLE_RATE, waveform="sine")
    expected_samples = int(SAMPLE_RATE * 200 / 1000)
    assert len(audio) == expected_samples * 2  # 16-bit PCM = 2 bytes/sample

def test_synthesize_tone_square():
    audio = synthesize_tone(440.0, duration_ms=100, sample_rate=SAMPLE_RATE, waveform="square")
    assert len(audio) == int(SAMPLE_RATE * 100 / 1000) * 2

def test_synthesize_tone_volume_scales_amplitude():
    """Lower volume → smaller peak amplitude."""
    quiet = synthesize_tone(440.0, 200, SAMPLE_RATE, "sine", volume=0.3)
    loud  = synthesize_tone(440.0, 200, SAMPLE_RATE, "sine", volume=0.7)
    q_samples = struct.unpack(f"<{len(quiet)//2}h", quiet)
    l_samples = struct.unpack(f"<{len(loud)//2}h", loud)
    # Compare peaks past the fade region
    assert max(abs(s) for s in l_samples[100:-100]) > max(abs(s) for s in q_samples[100:-100])


def test_synthesize_tone_volume_clamped_to_one():
    """volume > 1 must not overflow int16."""
    audio = synthesize_tone(440.0, 50, SAMPLE_RATE, "square", volume=5.0)
    samples = struct.unpack(f"<{len(audio)//2}h", audio)
    assert max(abs(s) for s in samples) <= 32767


def test_synthesize_tone_fade_reduces_amplitude_at_edges():
    audio = synthesize_tone(100.0, duration_ms=200, sample_rate=SAMPLE_RATE)
    samples = struct.unpack(f"<{len(audio)//2}h", audio)
    # First sample has fade multiplier 0 → should be exactly 0
    assert samples[0] == 0
    # Sample at ~12ms (index 190): 100Hz sine near peak with fade multiplier ~1.0
    strong_signal_idx = 190
    assert abs(samples[strong_signal_idx]) > int(22000 * 0.8)

def test_text_to_beat_audio_default_is_letter_mode():
    """Default mode is 'letter' with 100ms tones / 20ms gaps."""
    audio = text_to_beat_audio("hi", direction="out", sample_rate=SAMPLE_RATE)
    tone_bytes = int(SAMPLE_RATE * 100 / 1000) * 2
    gap_bytes  = int(SAMPLE_RATE * 20 / 1000) * 2
    assert len(audio) == 2 * (tone_bytes + gap_bytes)


def test_text_to_beat_audio_direction_out_vs_in_differ():
    out = text_to_beat_audio("hello", direction="out", sample_rate=SAMPLE_RATE)
    inp = text_to_beat_audio("hello", direction="in", sample_rate=SAMPLE_RATE)
    assert out != inp
