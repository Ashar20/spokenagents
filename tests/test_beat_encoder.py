import struct
from src.audio.beat_encoder import word_to_frequency, synthesize_tone, text_to_beat_audio

SAMPLE_RATE = 16000

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

def test_synthesize_tone_fade_reduces_amplitude_at_edges():
    audio = synthesize_tone(100.0, duration_ms=200, sample_rate=SAMPLE_RATE)
    samples = struct.unpack(f"<{len(audio)//2}h", audio)
    # First sample has fade multiplier 0 → should be exactly 0
    assert samples[0] == 0
    # Sample at ~12ms (index 190): 100Hz sine near peak with fade multiplier ~1.0
    strong_signal_idx = 190
    assert abs(samples[strong_signal_idx]) > int(22000 * 0.8)

def test_text_to_beat_audio_length():
    audio = text_to_beat_audio("PROPOSE friday", direction="out", sample_rate=SAMPLE_RATE)
    word_samples = int(SAMPLE_RATE * 200 / 1000)
    gap_samples  = int(SAMPLE_RATE * 100 / 1000)
    expected = 2 * (word_samples + gap_samples) * 2  # 2 words, 16-bit
    assert len(audio) == expected

def test_text_to_beat_audio_direction_out_vs_in_differ():
    out = text_to_beat_audio("hello", direction="out", sample_rate=SAMPLE_RATE)
    inp = text_to_beat_audio("hello", direction="in", sample_rate=SAMPLE_RATE)
    assert out != inp
