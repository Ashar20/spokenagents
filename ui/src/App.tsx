import { Routes, Route, Link } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import Landing from "./pages/Landing";
import Pitch from "./pages/Pitch";
import CreateAgent from "./pages/CreateAgent";
import { CallFrame } from "./CallFrame";
import { PixelOffice } from "./PixelOffice";
import { TracePanel } from "./TracePanel";
import { TollgateLogo } from "./components/TollgateLogo";

const WS_URL = import.meta.env.VITE_WS_URL
  ?? (import.meta.env.PROD ? "wss://spokenagents.philotheephilix.in/ws" : "ws://localhost:8765");
const ACCENT = "#FF3300";

function DemoNav() {
  const { login, authenticated, user } = usePrivy();
  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#0a0a0a]">
      <Link to="/" className="flex items-center gap-3">
        <TollgateLogo size={32} color={ACCENT} />
        <span className="text-sm font-mono text-white/55 hidden md:block tracking-wide">TOLLGATE / DEMO</span>
      </Link>
      <div className="flex items-center gap-6">
        <Link to="/pitch" className="text-sm text-white/45 hover:text-white transition-colors hidden md:block">
          Pitch deck
        </Link>
        <Link to="/create-agent" className="text-sm text-white/45 hover:text-white transition-colors hidden md:block">
          Create Agent
        </Link>
        <button
          onClick={authenticated ? undefined : login}
          className="text-xs px-4 py-2 rounded-full border font-mono transition-colors"
          style={{
            borderColor: authenticated ? `${ACCENT}40` : "rgba(255,255,255,0.15)",
            color: authenticated ? ACCENT : "rgba(255,255,255,0.6)",
          }}
        >
          {authenticated && user?.wallet?.address
            ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
            : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}

function DemoApp() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <DemoNav />

      <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-10 flex flex-col">
        {/* Hero */}
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: ACCENT }}>
            Live Demo — Two Agents, One Paid Channel
          </p>
          <h1
            className="text-4xl md:text-5xl font-black leading-none tracking-tighter mb-3"
            style={{ fontFamily: '"Butler", serif' }}
          >
            Call Alex's <span style={{ color: ACCENT }}>agent.</span>
          </h1>
          <p className="text-white/55 text-sm leading-relaxed max-w-2xl">
            Say <span className="font-mono text-white/80">"order food from Bella"</span> — Alex will
            run the negotiation and you'll hear machine beats while it talks to Bella's agent over AXL.
          </p>
        </div>

        {/* Two-column layout: left = 01+02 stacked, right = 03 trace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 min-h-0">

          {/* Left column — voice + pixel office */}
          <div className="flex flex-col gap-6 min-h-0">
            {/* 01 — Voice Call */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xs font-mono tracking-widest uppercase text-white/45">
                  01 — Voice Call
                </h2>
                <span className="text-xs font-mono text-white/25">Daily · Pipecat · Deepgram</span>
              </div>
              <CallFrame />
            </div>

            {/* 02 — Pixel Office */}
            <div className="flex-1 min-h-0">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xs font-mono tracking-widest uppercase text-white/45">
                  02 — Pixel Office
                </h2>
                <span className="text-xs font-mono text-white/25">Alex &amp; Bella animate live</span>
              </div>
              <PixelOffice />
            </div>
          </div>

          {/* Right column — 03 trace panel pinned to viewport height */}
          <div
            className="flex flex-col lg:sticky lg:top-6"
            style={{ height: "calc(100vh - 140px)" }}
          >
            <div className="flex items-baseline justify-between mb-3 shrink-0">
              <h2 className="text-xs font-mono tracking-widest uppercase text-white/45">
                03 — Agent Call Trace
              </h2>
              <span className="text-xs font-mono text-white/25">
                ENS → Toll → AXL
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <TracePanel wsUrl={WS_URL} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 mt-8 pt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs font-mono text-white/30 leading-relaxed max-w-md">
            Audio events: connect with sound on to hear the handshake sweep, negotiation chirps,
            and settlement chime.
          </p>
          <div className="flex gap-4 text-xs font-mono text-white/30">
            <Link to="/" className="hover:text-white transition-colors">← Landing</Link>
            <Link to="/pitch" className="hover:text-white transition-colors">Pitch</Link>
            <Link to="/create-agent" className="hover:text-white transition-colors">Create Agent</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pitch" element={<Pitch />} />
      <Route path="/create-agent" element={<CreateAgent />} />
      <Route path="/app" element={<DemoApp />} />
    </Routes>
  );
}
