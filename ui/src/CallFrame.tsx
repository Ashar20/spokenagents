import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";

const API_BASE = "http://localhost:8080";
const ACCENT = "#FF3300";

interface CallSession {
  call_id: string;
  room_url: string;
  room_name: string;
}

export function CallFrame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "joined" | "ending">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.destroy();
      callRef.current = null;
    };
  }, []);

  async function start() {
    setError(null);
    setState("starting");
    try {
      const resp = await fetch(`${API_BASE}/api/start-call`, { method: "POST" });
      if (!resp.ok) throw new Error(`start-call failed: ${resp.status}`);
      const session = (await resp.json()) as CallSession;
      sessionRef.current = session;

      await new Promise((r) => setTimeout(r, 1500));

      if (!containerRef.current) throw new Error("no container");
      const call = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: "100%",
          height: "360px",
          border: "0",
          borderRadius: "16px",
        },
        showLeaveButton: true,
        showFullscreenButton: false,
      });
      callRef.current = call;
      call.on("joined-meeting", () => setState("joined"));
      call.on("left-meeting", async () => {
        await endCall(false);
      });
      await call.join({ url: session.room_url });
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  async function endCall(destroyFrame: boolean) {
    setState("ending");
    const session = sessionRef.current;
    sessionRef.current = null;
    if (destroyFrame) {
      callRef.current?.destroy();
      callRef.current = null;
    }
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
      ? "Connected — speak to Alex"
      : state === "starting"
      ? "Spawning Alex agent…"
      : state === "ending"
      ? "Ending call…"
      : "Click to start a fresh call with Alex";

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 px-5 py-4 mb-3 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: dotColor,
            boxShadow: state === "joined" ? "0 0 8px #00FF88" : state === "starting" ? `0 0 8px ${ACCENT}` : "none",
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
        {state === "joined" && (
          <button
            onClick={() => endCall(true)}
            className="border border-white/20 text-white/80 px-5 py-2 text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-colors rounded-lg"
          >
            End
          </button>
        )}
      </div>
      <div ref={containerRef} className="w-full" />
      {error && (
        <div className="mt-2 px-4 py-2 rounded-lg border border-[#FF3300]/30 bg-[#FF3300]/5 text-[#FF3300] text-sm font-mono">
          Error: {error}
        </div>
      )}
    </div>
  );
}
