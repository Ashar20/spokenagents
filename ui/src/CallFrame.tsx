import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";

const API_BASE = "http://localhost:8080";

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

      // Give Alex a moment to join the room first
      await new Promise((r) => setTimeout(r, 1500));

      if (!containerRef.current) throw new Error("no container");
      const call = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: "100%",
          height: "320px",
          border: "0",
          borderRadius: "8px",
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
    state === "joined" ? "#10B981" : state === "starting" ? "#F59E0B" : "#6B7280";
  const statusText =
    state === "joined"
      ? "Connected — speak to Alex"
      : state === "starting"
      ? "Spawning Alex agent..."
      : state === "ending"
      ? "Ending call..."
      : "Click to start a fresh call with Alex";

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          padding: "12px",
          background: "#1F2937",
          borderRadius: 8,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
        <span style={{ color: "#D1D5DB", fontSize: 13, flex: 1 }}>{statusText}</span>
        {state === "idle" && (
          <button
            onClick={start}
            style={{
              background: "#3B82F6",
              color: "white",
              border: "0",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Call Alex
          </button>
        )}
        {state === "joined" && (
          <button
            onClick={() => endCall(true)}
            style={{
              background: "#EF4444",
              color: "white",
              border: "0",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            End
          </button>
        )}
      </div>
      <div ref={containerRef} style={{ width: "100%" }} />
      {error && (
        <div style={{ color: "#EF4444", fontSize: 13, marginTop: 8 }}>Error: {error}</div>
      )}
    </div>
  );
}
