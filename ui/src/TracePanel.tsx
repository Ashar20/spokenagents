import { useEffect, useRef, useState } from "react";
import { handleAudioEvent } from "./audio";

interface TraceEvent {
  id: number;
  time: string;
  event: string;
  data: Record<string, unknown>;
}

const ACCENT = "#FF3300";

const EVENT_COLORS: Record<string, string> = {
  ens_resolving: "rgba(82,152,255,0.6)",
  ens_resolved: "#5298FF",
  toll_paying: ACCENT,
  toll_paid: "#FF3300",
  handshake_sweep: "#FFD700",
  chirp: "#00FF88",
  settlement_executing: ACCENT,
  settlement_done: "#00FF88",
  default: "rgba(255,255,255,0.5)",
};

const EVENT_LABELS: Record<string, string> = {
  ens_resolving: "ENS Resolving",
  ens_resolved: "ENS Resolved",
  toll_paying: "Toll Paying",
  toll_paid: "Toll Paid",
  handshake_sweep: "AXL Handshake",
  chirp: "AXL Message",
  settlement_executing: "Settlement",
  settlement_done: "Settled",
};

export function TracePanel({ wsUrl }: { wsUrl: string }) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Waiting for agent call…");
  const counterRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        setStatus("Connected — ready for agent call");
      };

      ws.onmessage = async (msg) => {
        try {
          const data = JSON.parse(msg.data as string) as Record<string, unknown>;
          const eventType = (data.event as string) ?? "unknown";

          if (eventType === "ens_resolving") setStatus("Resolving ENS…");
          else if (eventType === "toll_paid") setStatus("Toll paid — opening AXL channel…");
          else if (eventType === "handshake_sweep") setStatus("AXL handshake…");
          else if (eventType === "settlement_done") setStatus("Done — table booked!");

          setEvents((prev) => [
            ...prev,
            {
              id: counterRef.current++,
              time: new Date().toISOString().slice(11, 23),
              event: eventType,
              data,
            },
          ]);

          window.dispatchEvent(new CustomEvent("tollgate:event", { detail: data }));

          if (data.msg_type) {
            window.dispatchEvent(
              new CustomEvent("tollgate:event", {
                detail: { ...data, event: data.msg_type },
              }),
            );
          }

          await handleAudioEvent(eventType, data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setStatus("WebSocket error — retrying…");
      };

      ws.onclose = () => {
        setConnected(false);
        setStatus("Disconnected — retrying in 3s…");
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      ws?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [wsUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center gap-3 px-5 py-3 mb-4 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: connected ? "#00FF88" : ACCENT,
            boxShadow: connected ? "0 0 8px #00FF88" : `0 0 8px ${ACCENT}`,
          }}
        />
        <span className="text-sm text-white/65 font-mono flex-1">{status}</span>
        <span
          className="text-xs font-mono tracking-widest uppercase"
          style={{ color: connected ? "#00FF88" : ACCENT }}
        >
          {connected ? "● LIVE" : "○ OFFLINE"}
        </span>
      </div>

      {/* Event log */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm max-h-[480px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-white/30 italic">
            No events yet. Start the agent call to see ENS → toll → AXL → settlement.
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex gap-4 py-1.5 border-b border-white/[0.04] last:border-0">
              <span className="text-white/30 shrink-0 w-24">{e.time}</span>
              <span
                className="shrink-0 w-36 font-bold"
                style={{ color: EVENT_COLORS[e.event] ?? EVENT_COLORS.default }}
              >
                {EVENT_LABELS[e.event] ?? e.event}
              </span>
              <span className="text-white/45 truncate">
                {Object.entries(e.data)
                  .filter(([k]) => k !== "event")
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join("  ")}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
