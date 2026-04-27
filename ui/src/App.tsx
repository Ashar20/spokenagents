import { TracePanel } from "./TracePanel";

const WS_URL = "ws://localhost:8765";

export default function App() {
  return (
    <div
      style={{
        background: "#0F172A",
        minHeight: "100vh",
        color: "#F1F5F9",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #1E293B",
          padding: "16px 24px",
          display: "flex",
          alignItems: "baseline",
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>
          Tollgate
        </h1>
        <span style={{ color: "#64748B", fontSize: 13 }}>
          Stripe for agent-to-agent calls
        </span>
      </div>

      {/* Subtitle */}
      <div style={{ padding: "16px 24px 8px" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#94A3B8" }}>
          Agent Call Trace
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
          ENS discovery → toll payment → AXL negotiation → settlement
        </p>
      </div>

      {/* Trace panel */}
      <TracePanel wsUrl={WS_URL} />

      {/* Footer */}
      <div style={{ padding: "24px", color: "#334155", fontSize: 12 }}>
        Audio events: connect browser with sound on to hear the handshake sweep, negotiation chirps, and settlement chime.
      </div>
    </div>
  );
}
