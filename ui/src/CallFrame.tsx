import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";

const API_BASE = "http://localhost:8080";
const ACCENT = "#FF3300";

interface CallSession {
  call_id: string;
  room_url: string;
  room_name: string;
}

interface VizSlot {
  id: string;
  name: string;
  role: string;
  color: string;
  track: MediaStreamTrack | null;
  isLocal: boolean;
}

const EMPTY_SLOTS: VizSlot[] = [
  {
    id: "local",
    name: "YOU",
    role: "Caller (mic)",
    color: "#FF4D1C",
    track: null,
    isLocal: true,
  },
  {
    id: "remote",
    name: "ALEX",
    role: "Agent (alex.spokenagents.eth)",
    color: "#6C63FF",
    track: null,
    isLocal: false,
  },
];

interface VoiceVisualizerProps {
  slot: VizSlot;
  active: boolean;
  onLevel: (id: string, level: number) => void;
}

function VoiceVisualizer({ slot, active, onLevel }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const onLevelRef = useRef(onLevel);

  useEffect(() => {
    onLevelRef.current = onLevel;
  }, [onLevel]);

  // Audio frequency analyser + visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    // Idle render (no track yet)
    if (!slot.track) {
      const drawIdle = () => {
        const w = canvas.width;
        const h = canvas.height;
        ctx2d.clearRect(0, 0, w, h);
        ctx2d.strokeStyle = `${slot.color}33`;
        ctx2d.lineWidth = 2 * dpr;
        ctx2d.beginPath();
        ctx2d.moveTo(0, h / 2);
        ctx2d.lineTo(w, h / 2);
        ctx2d.stroke();
      };
      drawIdle();
      onLevelRef.current(slot.id, 0);
      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;

    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctor();
      const stream = new MediaStream([slot.track]);
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
    } catch (e) {
      console.warn("audio analyser setup failed:", e);
      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastReport = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      // Voice range tends to live in lower 1/3 of the FFT bins; sample that.
      const usable = Math.floor(bufferLength * 0.55);
      const barCount = 56;
      const step = Math.max(1, Math.floor(usable / barCount));
      const barWidth = w / barCount;

      let sumAll = 0;
      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const avg = sum / step;
        sumAll += avg;
        const v = avg / 255;
        const barHeight = Math.max(2 * dpr, v * h * 0.85);
        const y = (h - barHeight) / 2;
        const x = i * barWidth + 1;

        const grad = ctx2d.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, slot.color);
        grad.addColorStop(1, `${slot.color}44`);
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(x, y, Math.max(1, barWidth - 2 * dpr), barHeight);
      }

      const now = performance.now();
      if (now - lastReport > 80) {
        lastReport = now;
        onLevelRef.current(slot.id, sumAll / barCount);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      try {
        source?.disconnect();
        analyser?.disconnect();
        audioCtx?.close();
      } catch {
        /* noop */
      }
      onLevelRef.current(slot.id, 0);
    };
  }, [slot.track, slot.color, slot.id]);

  // Hidden <audio> element so we can hear the remote (Alex). Local mic is
  // already captured by Daily so we never play it back (avoids feedback).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (slot.track && !slot.isLocal) {
      el.srcObject = new MediaStream([slot.track]);
      el.play().catch(() => {
        /* user gesture might be required, but join click already counts */
      });
    } else {
      el.srcObject = null;
    }
  }, [slot.track, slot.isLocal]);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        background: "#080A12",
        border: `1px solid ${active ? slot.color : `${slot.color}33`}`,
        borderRadius: 6,
        padding: 16,
        boxShadow: active ? `0 0 28px ${slot.color}55` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: slot.color,
              fontWeight: 700,
            }}
          >
            {slot.role}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 18,
                color: active ? "#E8E8F0" : slot.track ? "#B8B8D0" : "#6A6A88",
                fontWeight: 800,
                letterSpacing: "0.05em",
                transition: "color 0.2s",
                textShadow: active ? `0 0 12px ${slot.color}aa` : "none",
              }}
            >
              {slot.name}
            </span>
            {active && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "0.25em",
                  color: slot.color,
                  fontWeight: 700,
                  padding: "2px 6px",
                  border: `1px solid ${slot.color}88`,
                  borderRadius: 2,
                  animation: "spk-pulse 1s ease-in-out infinite",
                }}
              >
                ● SPEAKING
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: slot.track ? slot.color : "#2A2D3E",
            boxShadow: active ? `0 0 12px ${slot.color}` : "none",
            transition: "background 0.2s, box-shadow 0.2s",
            flexShrink: 0,
          }}
        />
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: 96,
          display: "block",
        }}
      />
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </div>
  );
}

export function CallFrame() {
  const callRef = useRef<DailyCall | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "joined" | "ending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<VizSlot[]>(EMPTY_SLOTS);
  const levelsRef = useRef<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  // Active speaker = whoever is currently loudest (above threshold).
  useEffect(() => {
    const t = setInterval(() => {
      const entries = Object.entries(levelsRef.current);
      if (entries.length === 0) {
        setActiveId(null);
        return;
      }
      let bestId: string | null = null;
      let bestLvl = 0;
      for (const [id, lvl] of entries) {
        if (lvl > bestLvl) {
          bestLvl = lvl;
          bestId = id;
        }
      }
      setActiveId((prev) => {
        const next = bestLvl > 6 ? bestId : null;
        return next === prev ? prev : next;
      });
    }, 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      try {
        callRef.current?.destroy();
      } catch {
        /* noop */
      }
      callRef.current = null;
    };
  }, []);

  const handleLevel = useCallback((id: string, l: number) => {
    levelsRef.current[id] = l;
  }, []);

  function syncParticipants(call: DailyCall) {
    const all = call.participants();
    const local = all.local;
    const localTrack =
      (local?.tracks?.audio?.persistentTrack as MediaStreamTrack | undefined) ?? null;

    const remotes = Object.values(all).filter(
      (p) => p && (p as { local?: boolean }).local !== true,
    );
    const remote = remotes[0];
    const remoteTrack =
      (remote?.tracks?.audio?.persistentTrack as MediaStreamTrack | undefined) ?? null;
    const remoteName =
      remote?.user_name && remote.user_name.trim().length > 0
        ? remote.user_name.toUpperCase()
        : "ALEX";

    setSlots([
      {
        id: "local",
        name: "YOU",
        role: "Caller (mic)",
        color: "#FF4D1C",
        track: localTrack,
        isLocal: true,
      },
      {
        id: "remote",
        name: remoteName,
        role: "Agent (alex.spokenagents.eth)",
        color: "#6C63FF",
        track: remoteTrack,
        isLocal: false,
      },
    ]);
  }

  async function start() {
    setError(null);
    setState("starting");
    try {
      const resp = await fetch(`${API_BASE}/api/start-call`, { method: "POST" });
      if (!resp.ok) throw new Error(`start-call failed: ${resp.status}`);
      const session = (await resp.json()) as CallSession;
      sessionRef.current = session;

      await new Promise((r) => setTimeout(r, 1500));

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      });
      callRef.current = call;

      const onUpdate = () => {
        try {
          syncParticipants(call);
        } catch (e) {
          console.warn("syncParticipants failed:", e);
        }
      };

      call.on("joined-meeting", () => {
        setState("joined");
        onUpdate();
      });
      call.on("participant-joined", onUpdate);
      call.on("participant-updated", onUpdate);
      call.on("participant-left", onUpdate);
      call.on("track-started", onUpdate);
      call.on("track-stopped", onUpdate);
      call.on("left-meeting", () => {
        endCall(false).catch(() => undefined);
      });

      await call.join({ url: session.room_url });
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  async function endCall(destroyCall: boolean) {
    setState("ending");
    const session = sessionRef.current;
    sessionRef.current = null;
    if (destroyCall) {
      try {
        await callRef.current?.leave();
      } catch {
        /* noop */
      }
      try {
        callRef.current?.destroy();
      } catch {
        /* noop */
      }
      callRef.current = null;
    }
    levelsRef.current = {};
    setActiveId(null);
    setSlots(EMPTY_SLOTS);
    if (session) {
      try {
        await fetch(`${API_BASE}/api/end-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ call_id: session.call_id }),
        });
      } catch (e) {
        console.warn("end-call cleanup failed:", e);
      }
    }
    setState("idle");
  }

  const dotColor =
    state === "joined" ? "#00FF88" : state === "starting" ? ACCENT : "rgba(255,255,255,0.25)";
  const statusText =
    state === "joined"
      ? activeId === "local"
        ? "You're speaking — Alex is listening"
        : activeId === "remote"
        ? "Alex is speaking"
        : "Connected — say something"
      : state === "starting"
      ? "Spawning Alex agent…"
      : state === "ending"
      ? "Ending call…"
      : "Click to start a fresh call with Alex";

  return (
    <div className="mb-4">
      <style>{`@keyframes spk-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>

      <div className="flex items-center gap-3 px-5 py-4 mb-3 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: dotColor,
            boxShadow:
              state === "joined"
                ? "0 0 8px #00FF88"
                : state === "starting"
                ? `0 0 8px ${ACCENT}`
                : "none",
          }}
        />
        <span className="text-sm text-white/65 flex-1 font-mono">{statusText}</span>
        {state === "idle" && (
          <button
            onClick={start}
            className="bg-[#FF3300] text-black px-5 py-2 text-xs font-bold tracking-widest uppercase hover:bg-[#cc2900] transition-colors rounded-lg"
          >
            Call Alex →
          </button>
        )}
        {(state === "joined" || state === "starting") && (
          <button
            onClick={() => endCall(true)}
            className="border border-white/20 text-white/80 px-5 py-2 text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-colors rounded-lg"
          >
            End
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {slots.map((slot) => (
          <VoiceVisualizer
            key={slot.id}
            slot={slot}
            active={activeId === slot.id}
            onLevel={handleLevel}
          />
        ))}
      </div>

      {error && (
        <div className="mt-2 px-4 py-2 rounded-lg border border-[#FF3300]/30 bg-[#FF3300]/5 text-[#FF3300] text-sm font-mono">
          Error: {error}
        </div>
      )}
    </div>
  );
}
