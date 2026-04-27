import { useEffect, useRef, useState } from "react";
import { handleAudioEvent } from "./audio";

interface TraceEvent {
  id: number;
  time: string;
  event: string;
  data: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, string> = {
  ens_resolving: "#6B7280",
  ens_resolved: "#10B981",
  toll_paying: "#F59E0B",
  toll_paid: "#10B981",
  handshake_sweep: "#8B5CF6",
  chirp: "#3B82F6",
  settlement_executing: "#F59E0B",
  settlement_done: "#10B981",
  default: "#9CA3AF",
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
  const [status, setStatus] = useState("Waiting for agent call...");
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

          if (eventType === "ens_resolving") setStatus("Resolving ENS...");
          else if (eventType === "toll_paid") setStatus("Toll paid — opening AXL channel...");
          else if (eventType === "handshake_sweep") setStatus("AXL handshake...");
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

          await handleAudioEvent(eventType, data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setStatus("WebSocket error — retrying...");
      };

      ws.onclose = () => {
        setConnected(false);
        setStatus("Disconnected — retrying in 3s...");
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
    <div style={{ padding: "0 16px" }}>
      {/* Status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          padding: "8px 12px",
          background: "#1F2937",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: connected ? "#10B981" : "#EF4444",
          }}
        />
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>{status}</span>
      </div>

      {/* Event log */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 13,
          maxHeight: 500,
          overflowY: "auto",
          background: "#111827",
          borderRadius: 6,
          padding: 12,
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: "#4B5563" }}>No events yet. Start the agent call to see the trace.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} style={{ marginBottom: 6, display: "flex", gap: 12 }}>
              <span style={{ color: "#6B7280", minWidth: 90 }}>{e.time}</span>
              <span
                style={{
                  color: EVENT_COLORS[e.event] ?? EVENT_COLORS.default,
                  minWidth: 140,
                  fontWeight: 600,
                }}
              >
                {EVENT_LABELS[e.event] ?? e.event}
              </span>
              <span style={{ color: "#9CA3AF" }}>
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
