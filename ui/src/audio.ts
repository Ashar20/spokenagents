// Tone.js audio state machine for Tollgate demo
// Maps WebSocket events to synchronized audio cues

import * as Tone from "tone";

let synthReady = false;
let synth: Tone.Synth;

async function ensureSynth() {
  if (synthReady) return;
  await Tone.start();
  synth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
  }).toDestination();
  synthReady = true;
}

export async function playHandshakeSweep(): Promise<void> {
  await ensureSynth();
  const sweep = new Tone.Oscillator({
    frequency: 400,
    type: "sine",
  }).toDestination();
  sweep.start();
  sweep.frequency.rampTo(2000, 1.2);
  setTimeout(() => sweep.stop(), 1400);
}

export async function playChirp(msgType: string): Promise<void> {
  await ensureSynth();
  const freqMap: Record<string, string> = {
    PROPOSE: "A5",
    COUNTER: "E5",
    ACCEPT: "C6",
    CONFIRM: "G6",
    REJECT: "A3",
  };
  const freq = freqMap[msgType] ?? "C5";
  synth.triggerAttackRelease(freq, "16n");
}

export async function playSettlementChime(): Promise<void> {
  await ensureSynth();
  synth.triggerAttackRelease("E5", "8n");
  setTimeout(() => synth.triggerAttackRelease("G#5", "8n"), 300);
}

export async function handleAudioEvent(event: string, data?: Record<string, unknown>): Promise<void> {
  if (event === "handshake_sweep") {
    await playHandshakeSweep();
  } else if (event === "settlement_done") {
    await playSettlementChime();
  } else if (event === "chirp") {
    const msgType = (data?.msg_type as string) ?? event;
    await playChirp(msgType);
  } else if (["PROPOSE", "COUNTER", "ACCEPT", "CONFIRM", "REJECT"].includes(event)) {
    await playChirp(event);
  }
}
