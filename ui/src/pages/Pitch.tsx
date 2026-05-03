import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const ACCENT = "#FF3300";

// ─── Animated SVG visuals ──────────────────────────────────────────────────

function TollgateLogoLarge() {
  return (
    <svg width="96" height="96" viewBox="0 0 72 72" fill="none">
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i * 360) / 20;
        const rad = (angle * Math.PI) / 180;
        const r = 30;
        const cx = 36 + r * Math.cos(rad);
        const cy = 36 + r * Math.sin(rad);
        const size = i % 3 === 0 ? 3.5 : i % 2 === 0 ? 2.5 : 1.8;
        return (
          <motion.circle key={i} cx={cx} cy={cy} r={size} fill={ACCENT}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          />
        );
      })}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i * 360) / 10 + 18;
        const rad = (angle * Math.PI) / 180;
        const r = 15;
        const cx = 36 + r * Math.cos(rad);
        const cy = 36 + r * Math.sin(rad);
        return (
          <motion.circle key={`i-${i}`} cx={cx} cy={cy} r={1.8} fill="white"
            initial={{ opacity: 0 }} animate={{ opacity: 0.5 }}
            transition={{ delay: 0.6 + i * 0.04 }}
          />
        );
      })}
      <motion.circle cx="36" cy="36" r="5" fill={ACCENT}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.9, type: "spring" }}
      />
    </svg>
  );
}

function AgentSpamSVG() {
  return (
    <svg viewBox="0 0 600 400" className="w-full max-w-2xl" fill="none">
      {[
        { x: 30, y: 60 }, { x: 30, y: 150 }, { x: 30, y: 240 }, { x: 30, y: 330 },
        { x: 110, y: 110 }, { x: 110, y: 290 },
      ].map((pos, i) => (
        <g key={i}>
          <rect x={pos.x} y={pos.y - 22} width={84} height={44} rx={8}
            fill="#1a1a1a" stroke="rgba(255,51,0,0.35)" strokeWidth={1.5} />
          <text x={pos.x + 42} y={pos.y + 6} textAnchor="middle"
            fontSize={16} fill="#FF3300" fontFamily="monospace" fontWeight={600}>SPAM</text>
          <motion.line x1={pos.x + 84} y1={pos.y} x2={285} y2={195}
            stroke="#FF3300" strokeWidth={1.5} strokeDasharray="6 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ delay: i * 0.15, duration: 0.8 }}
          />
        </g>
      ))}
      <motion.rect x={270} y={150} width={120} height={90} rx={12}
        fill="#1a1a1a" stroke="rgba(255,51,0,0.7)" strokeWidth={2.5}
        animate={{ stroke: ["rgba(255,51,0,0.4)", "rgba(255,51,0,1)", "rgba(255,51,0,0.4)"] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      <text x={330} y={190} textAnchor="middle" fontSize={18} fill="white" fontFamily="monospace" fontWeight={600}>bella.eth</text>
      <text x={330} y={215} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.5)" fontFamily="monospace">OVERWHELMED</text>
      <text x={150} y={385} textAnchor="middle" fontSize={15} fill="rgba(255,255,255,0.5)" fontFamily="monospace">Cost to send: $0.001</text>
      <text x={450} y={385} textAnchor="middle" fontSize={15} fill="rgba(255,255,255,0.5)" fontFamily="monospace">Cost to receive: $0.10+</text>
    </svg>
  );
}

function TollgateDiagramSVG() {
  const [step, setStep] = useState(0);
  const steps = ["ENS lookup", "Toll paid", "AXL open", "Negotiate", "Settle", "Done ✓"];
  const colors = [ACCENT, ACCENT, "#00FF88", "#FFD700", ACCENT, "#00FF88"];

  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <svg viewBox="0 0 640 380" className="w-full max-w-2xl" fill="none">
      {/* Caller */}
      <rect x={20} y={140} width={130} height={75} rx={10}
        fill="#1a1a1a" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <text x={85} y={175} textAnchor="middle" fontSize={17} fill="white" fontFamily="monospace" fontWeight={600}>alex.eth</text>
      <text x={85} y={198} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.45)" fontFamily="monospace">caller</text>

      {/* Tollgate center */}
      <motion.rect x={245} y={120} width={150} height={115} rx={14}
        fill="#0a0a0a" stroke={ACCENT} strokeWidth={2.5}
        animate={{ strokeOpacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
      />
      <text x={320} y={158} textAnchor="middle" fontSize={20} fill={ACCENT} fontFamily="serif" fontWeight={800}>TOLLGATE</text>
      <text x={320} y={185} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.5)" fontFamily="monospace">ENS · KeeperHub · AXL</text>
      <text x={320} y={212} textAnchor="middle" fontSize={14} fill={ACCENT} fontFamily="monospace" fontWeight={600}>$0.25 toll</text>

      {/* Callee */}
      <rect x={490} y={140} width={130} height={75} rx={10}
        fill="#1a1a1a" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <text x={555} y={175} textAnchor="middle" fontSize={17} fill="white" fontFamily="monospace" fontWeight={600}>bella.eth</text>
      <text x={555} y={198} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.45)" fontFamily="monospace">callee</text>

      {/* Lines */}
      <motion.line x1={150} y1={177} x2={245} y2={177}
        stroke={step >= 1 ? ACCENT : "rgba(255,255,255,0.12)"} strokeWidth={2.5} strokeDasharray="8 4"
        animate={{ opacity: 1 }} />
      <motion.line x1={395} y1={177} x2={490} y2={177}
        stroke={step >= 2 ? "#00FF88" : "rgba(255,255,255,0.12)"} strokeWidth={2.5} strokeDasharray="8 4"
        animate={{ opacity: step >= 2 ? 1 : 0.25 }} transition={{ duration: 0.4 }} />

      {/* Step indicator */}
      <rect x={195} y={285} width={250} height={40} rx={20} fill="#1a1a1a" />
      <AnimatePresence mode="wait">
        <motion.text key={step} x={320} y={310} textAnchor="middle" fontSize={16}
          fill={colors[step]} fontFamily="monospace" fontWeight={600}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {`0${step + 1} — ${steps[step]}`}
        </motion.text>
      </AnimatePresence>

      {/* Live indicator */}
      <motion.circle cx={320} cy={68} r={8} fill={ACCENT}
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      <text x={320} y={98} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.4)" fontFamily="monospace" fontWeight={600}>LIVE</text>
    </svg>
  );
}

function AXLFlowSVG() {
  const messages = ["PROPOSE", "COUNTER", "ACCEPT", "CONFIRM"];
  const msgColors = [ACCENT, "#FFD700", "#00FF88", "#00FF88"];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % messages.length), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <svg viewBox="0 0 640 360" className="w-full max-w-2xl" fill="none">
      {/* Alex node */}
      <rect x={20} y={100} width={120} height={140} rx={10}
        fill="#0a0a0a" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <text x={80} y={140} textAnchor="middle" fontSize={16} fill="white" fontFamily="monospace" fontWeight={600}>alex.eth</text>
      <text x={80} y={162} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.4)" fontFamily="monospace">AXL node</text>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.rect key={i} x={36 + i * 14} y={195} width={10} rx={5} fill={ACCENT}
          animate={{ height: [6, 26 + i * 4, 6], y: [218, 192 - i * 2, 218] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
        />
      ))}

      {/* Bella node */}
      <rect x={500} y={100} width={120} height={140} rx={10}
        fill="#0a0a0a" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <text x={560} y={140} textAnchor="middle" fontSize={16} fill="white" fontFamily="monospace" fontWeight={600}>bella.eth</text>
      <text x={560} y={162} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.4)" fontFamily="monospace">AXL node</text>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.rect key={i} x={516 + i * 14} y={195} width={10} rx={5} fill="#00FF88"
          animate={{ height: [6, 22 + i * 3, 6], y: [218, 196 - i * 1.5, 218] }}
          transition={{ repeat: Infinity, duration: 1.0, delay: i * 0.12 }}
        />
      ))}

      {/* Channel pill */}
      <rect x={180} y={150} width={280} height={56} rx={28}
        fill="#1a1a1a" stroke="rgba(255,255,255,0.1)" />
      <AnimatePresence mode="wait">
        <motion.text key={active} x={320} y={184} textAnchor="middle" fontSize={20}
          fill={msgColors[active]} fontFamily="monospace" fontWeight={700}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {messages[active]}
        </motion.text>
      </AnimatePresence>
      <text x={320} y={120} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.35)" fontFamily="monospace" fontWeight={600}>
        AXL P2P CHANNEL — ENCRYPTED
      </text>
      {/* Chirp dots */}
      {[0, 1, 2].map(i => (
        <motion.circle key={i} cx={270 + i * 28} cy={245} r={5} fill={ACCENT}
          animate={{ opacity: active === i ? [0.3, 1, 0.3] : 0.18, scale: active === i ? [1, 1.5, 1] : 1 }}
          transition={{ duration: 0.4 }}
        />
      ))}
      <text x={320} y={285} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.32)" fontFamily="monospace">
        ◈ chirps synced to message traffic ◈
      </text>
    </svg>
  );
}

function ArchitectureSVG() {
  return (
    <svg viewBox="0 0 760 460" className="w-full max-w-3xl" fill="none">
      {/* ENS */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <rect x={30} y={30} width={170} height={90} rx={14}
          fill="#0d1a3a" stroke="#5298FF40" strokeWidth={2} />
        <text x={115} y={70} textAnchor="middle" fontSize={22} fill="#5298FF" fontFamily="serif" fontWeight={800}>ENS</text>
        <text x={115} y={95} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.45)" fontFamily="monospace">Directory</text>
      </motion.g>
      {/* KeeperHub */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <rect x={295} y={30} width={170} height={90} rx={14}
          fill="#2a0a00" stroke={`${ACCENT}40`} strokeWidth={2} />
        <text x={380} y={70} textAnchor="middle" fontSize={20} fill={ACCENT} fontFamily="serif" fontWeight={800}>KeeperHub</text>
        <text x={380} y={95} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.45)" fontFamily="monospace">Payments</text>
      </motion.g>
      {/* AXL */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <rect x={560} y={30} width={170} height={90} rx={14}
          fill="#003a1a" stroke="#00FF8840" strokeWidth={2} />
        <text x={645} y={70} textAnchor="middle" fontSize={22} fill="#00FF88" fontFamily="serif" fontWeight={800}>AXL</text>
        <text x={645} y={95} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.45)" fontFamily="monospace">P2P Transport</text>
      </motion.g>
      {/* alex.eth */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <rect x={60} y={250} width={150} height={85} rx={12}
          fill="#1a1a1a" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
        <text x={135} y={290} textAnchor="middle" fontSize={17} fill="white" fontFamily="monospace" fontWeight={600}>alex.eth</text>
        <text x={135} y={313} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.4)" fontFamily="monospace">caller agent</text>
      </motion.g>
      {/* bella.eth */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <rect x={550} y={250} width={150} height={85} rx={12}
          fill="#1a1a1a" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
        <text x={625} y={290} textAnchor="middle" fontSize={17} fill="white" fontFamily="monospace" fontWeight={600}>bella.eth</text>
        <text x={625} y={313} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.4)" fontFamily="monospace">callee agent</text>
      </motion.g>
      {/* Connection lines */}
      <motion.path d="M135 250 L115 120" stroke="#5298FF" strokeWidth={1.5} strokeDasharray="6 4"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7, duration: 0.5 }} />
      <motion.path d="M210 290 L295 75" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6 4"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 0.5 }} />
      <motion.path d="M135 250 Q380 180 625 250" stroke="#00FF88" strokeWidth={2} strokeDasharray="8 4"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 0.8 }} />
      <motion.path d="M625 250 L115 120" stroke="#5298FF" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.4}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.5 }} />
      <motion.path d="M550 290 L465 75" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.4}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.0, duration: 0.5 }} />
      <text x={380} y={420} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.3)" fontFamily="monospace">
        All three sponsors are load-bearing. None are decorative.
      </text>
    </svg>
  );
}

function MarketSVG() {
  const bars = [
    { label: "2024", val: 15, color: "rgba(255,255,255,0.22)" },
    { label: "2025", val: 38, color: "rgba(255,255,255,0.4)" },
    { label: "2026", val: 72, color: ACCENT },
    { label: "2027", val: 160, color: ACCENT },
    { label: "2028", val: 310, color: ACCENT },
  ];
  return (
    <svg viewBox="0 0 600 360" className="w-full max-w-2xl" fill="none">
      <text x={300} y={30} textAnchor="middle" fontSize={14}
        fill="rgba(255,255,255,0.45)" fontFamily="monospace" fontWeight={600}>
        AGENT-TO-AGENT CALLS (indexed)
      </text>
      {bars.map((b, i) => {
        const h = (b.val / 310) * 235;
        const x = 50 + i * 105;
        return (
          <g key={i}>
            <motion.rect x={x} y={290 - h} width={75} height={h} rx={6} fill={b.color}
              initial={{ height: 0, y: 290 }} animate={{ height: h, y: 290 - h }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
            />
            <text x={x + 38} y={320} textAnchor="middle" fontSize={15}
              fill="rgba(255,255,255,0.45)" fontFamily="monospace" fontWeight={600}>{b.label}</text>
            <motion.text x={x + 38} y={290 - h - 10} textAnchor="middle" fontSize={16}
              fill={b.color} fontFamily="monospace" fontWeight={700}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.15 }}
            >{b.val}x</motion.text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Slides ─────────────────────────────────────────────────────────────────

const slides = [
  {
    id: "title", label: null,
    content: (
      <div className="flex flex-col items-center justify-center text-center h-full gap-10 relative">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}>
          <TollgateLogoLarge />
        </motion.div>
        <motion.h1
          className="text-8xl md:text-[10rem] font-black tracking-tighter leading-none"
          style={{ fontFamily: '"Butler", serif', color: ACCENT, fontWeight: 900 }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          TOLLGATE
        </motion.h1>
        <motion.p className="text-2xl md:text-3xl text-white/70 max-w-2xl"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        >
          Stripe for agent-to-agent calls.
        </motion.p>
        <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {["Gensyn AXL", "KeeperHub", "ENS"].map(tag => (
            <span key={tag} className="px-4 py-1.5 rounded-full border text-sm font-mono"
              style={{ borderColor: `${ACCENT}50`, color: `${ACCENT}` }}>{tag}</span>
          ))}
        </motion.div>
        <motion.div className="absolute bottom-8 flex flex-col items-center"
          animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12l7 7 7-7" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </motion.div>
      </div>
    ),
  },
  {
    id: "problem", label: "01 — The Problem",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-8 text-white"
            style={{ fontFamily: '"Butler", serif' }}>
            AI voice agents are<br /><span style={{ color: ACCENT }}>inevitable.</span>
          </h2>
          <ul className="space-y-4 text-white/70 text-lg max-w-md">
            {[
              "Every business deploys one this year",
              "LLM-generated calls cost fractions of a cent",
              "Any agent can call any agent, at infinite scale, for free",
              "No postage. No rate-limiting. No toll booth. Yet.",
            ].map(txt => (
              <li key={txt} className="flex gap-3">
                <span className="text-2xl leading-none" style={{ color: ACCENT }}>×</span>
                <span>{txt}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 flex justify-center"><AgentSpamSVG /></div>
      </div>
    ),
  },
  {
    id: "why-now", label: "02 — Why Now",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-8 text-white"
            style={{ fontFamily: '"Butler", serif' }}>
            The window is<br /><span style={{ color: ACCENT }}>right now.</span>
          </h2>
          <div className="grid gap-4 max-w-md">
            {[
              { num: "01", title: "Voice agents are proliferating", desc: "OpenAI, Anthropic, every Fortune 500 shipping voice agents in 2025." },
              { num: "02", title: "x402 is production-ready", desc: "HTTP-native micropayments over EVM. No extra infrastructure." },
              { num: "03", title: "ENS is the directory", desc: "A global, open, censorship-resistant registry already exists." },
            ].map(item => (
              <div key={item.num} className="border rounded-xl p-5"
                style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" }}>
                <span className="text-sm font-mono font-semibold" style={{ color: ACCENT }}>{item.num}</span>
                <p className="text-white font-bold text-lg mt-1">{item.title}</p>
                <p className="text-white/55 text-sm mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex justify-center"><MarketSVG /></div>
      </div>
    ),
  },
  {
    id: "solution", label: "03 — Solution",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-6 text-white"
            style={{ fontFamily: '"Butler", serif' }}>
            To reach an agent,<br /><span style={{ color: ACCENT }}>another agent pays.</span>
          </h2>
          <div className="border-l-4 pl-5 my-8 italic text-white/70 text-xl max-w-md leading-snug"
            style={{ borderColor: ACCENT }}>
            "The toll booth that should've been built before the highway."
          </div>
          <div className="grid grid-cols-3 gap-6 mt-10 max-w-md">
            {[
              { stat: "$0.25", label: "avg toll" },
              { stat: "30s", label: "end-to-end" },
              { stat: "100%", label: "on-chain audit" },
            ].map(s => (
              <div key={s.stat}>
                <div className="text-4xl md:text-5xl font-black" style={{ fontFamily: '"Butler", serif', color: ACCENT }}>{s.stat}</div>
                <div className="text-xs font-mono text-white/45 tracking-widest uppercase mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex justify-center"><TollgateDiagramSVG /></div>
      </div>
    ),
  },
  {
    id: "protocol", label: "04 — Protocol",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-10 text-white"
            style={{ fontFamily: '"Butler", serif' }}>
            Six phases.<br />One paid channel.
          </h2>
          <div className="space-y-4 max-w-md">
            {[
              { num: "01", label: "Discovery", detail: "bella.eth → AXL node + toll via ENS" },
              { num: "02", label: "Voice greeting", detail: "LiveKit, agent-to-agent detection" },
              { num: "03", label: "Toll payment", detail: "USDC via KeeperHub + modem sweep" },
              { num: "04", label: "AXL channel", detail: "P2P encrypted, verified by receipt" },
              { num: "05", label: "Negotiation", detail: "PROPOSE → ACCEPT → CONFIRM" },
              { num: "06", label: "Settlement", detail: "KeeperHub deposit + audit trail" },
            ].map((step, i) => (
              <motion.div key={step.num} className="flex gap-5 items-baseline"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
              >
                <span className="text-sm font-mono font-bold shrink-0 w-8" style={{ color: ACCENT }}>{step.num}</span>
                <div>
                  <span className="text-lg font-bold text-white">{step.label}</span>
                  <span className="text-sm text-white/50 ml-3">{step.detail}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex justify-center"><AXLFlowSVG /></div>
      </div>
    ),
  },
  {
    id: "technology", label: "05 — Technology",
    content: (
      <div className="h-full flex flex-col gap-10">
        <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter text-white"
          style={{ fontFamily: '"Butler", serif' }}>
          All three sponsors are <span style={{ color: ACCENT }}>load-bearing.</span>
        </h2>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <ArchitectureSVG />
        </div>
        <div className="grid grid-cols-3 gap-5 max-w-4xl">
          {[
            { name: "ENS", color: "#5298FF", desc: "Agent directory — AXL node, toll price, capabilities as text records." },
            { name: "KeeperHub", color: ACCENT, desc: "x402 toll + settlement with MEV protection and full audit trail." },
            { name: "Gensyn AXL", color: "#00FF88", desc: "Encrypted P2P negotiation — PROPOSE/ACCEPT/CONFIRM messages." },
          ].map(t => (
            <div key={t.name} className="border rounded-xl p-5"
              style={{ borderColor: `${t.color}30`, background: `${t.color}08` }}>
              <p className="font-bold text-lg mb-2" style={{ color: t.color }}>{t.name}</p>
              <p className="text-white/55 text-sm leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "demo", label: "06 — Demo",
    content: (
      <div className="h-full flex flex-col gap-10">
        <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter text-white"
          style={{ fontFamily: '"Butler", serif' }}>
          "Book me a table<br /><span style={{ color: ACCENT }}>at Bella."</span>
        </h2>
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          {[
            { num: "01", title: "Cold open", desc: "Alex's agent: 'Book me Bella, Friday, party of 4, up to $25.'" },
            { num: "02", title: "Spam demo", desc: "Unpaid call rejected at gate. This is why we built this." },
            { num: "03", title: "ENS resolves", desc: "bella.eth → toll $0.25 USDC. KeeperHub tx confirmed. Modem sweep." },
            { num: "04", title: "AXL negotiation", desc: "Chirps. PROPOSE → ACCEPT. Sub-second. Table Friday 8pm, $20 deposit." },
          ].map(s => (
            <div key={s.num} className="border rounded-2xl p-6"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" }}>
              <div className="text-sm font-mono font-bold mb-3" style={{ color: ACCENT }}>{s.num}</div>
              <p className="text-white font-bold text-lg mb-2">{s.title}</p>
              <p className="text-white/55 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6 text-sm font-mono">
          {[
            { label: "✓ AXL two-node deployment", color: "#00FF88" },
            { label: "✓ KeeperHub toll + settlement", color: ACCENT },
            { label: "✓ ENS text record resolution", color: "#5298FF" },
          ].map(b => <span key={b.label} style={{ color: b.color }}>{b.label}</span>)}
        </div>
      </div>
    ),
  },
  {
    id: "prizes", label: "07 — Prize Tracks",
    content: (
      <div className="h-full flex flex-col gap-10">
        <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter text-white"
          style={{ fontFamily: '"Butler", serif' }}>
          Three tracks.<br /><span style={{ color: ACCENT }}>One coherent build.</span>
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            { sponsor: "Gensyn", color: "#00FF88", track: "Best Application of AXL", proof: "Two AXL nodes. Full PROPOSE→CONFIRM over AXL. No central broker." },
            { sponsor: "KeeperHub", color: ACCENT, track: "Best Use + Feedback Bounty", proof: "x402 toll + settlement workflows. Public inbound-toll workflow. FEEDBACK.md." },
            { sponsor: "ENS", color: "#5298FF", track: "Best Integration + Most Creative", proof: "contact.price as novel ENS pattern. Without ENS, there's no directory." },
          ].map(p => (
            <div key={p.sponsor} className="border rounded-2xl p-7"
              style={{ borderColor: `${p.color}30`, background: `${p.color}08` }}>
              <div className="text-3xl md:text-4xl font-black mb-4" style={{ fontFamily: '"Butler", serif', color: p.color }}>{p.sponsor}</div>
              <p className="text-white text-lg font-bold mb-3">{p.track}</p>
              <p className="text-white/55 text-sm leading-relaxed">{p.proof}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm font-mono text-white/40">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }}></span>
          ETHGlobal Open Agents — May 2025
        </div>
      </div>
    ),
  },
  {
    id: "close", label: "08 — Build with us",
    content: (
      <div className="flex flex-col items-center justify-center text-center h-full gap-10 relative">
        <h2 className="text-7xl md:text-9xl font-black tracking-tighter leading-none"
          style={{ fontFamily: '"Butler", serif', color: ACCENT }}>
          The toll booth<br />is open.
        </h2>
        <p className="text-2xl text-white/65 max-w-2xl leading-snug">
          Every agent-to-agent call, everywhere, paying its way.
          Tollgate is the primitive the next decade needs.
        </p>
        <div className="flex gap-4 mt-4">
          <Link to="/app" className="px-10 py-4 text-base font-bold tracking-widest uppercase text-black transition-colors hover:opacity-90"
            style={{ background: ACCENT }}>
            Try the demo →
          </Link>
          <Link to="/create-agent"
            className="px-10 py-4 text-base font-bold tracking-widest uppercase border border-white/25 text-white hover:bg-white/5 transition-colors">
            Create an Agent
          </Link>
        </div>
        <div className="absolute bottom-8 flex gap-8 text-sm font-mono text-white/30">
          <span>ENS + KeeperHub + Gensyn AXL</span>
          <span>ETHGlobal Open Agents 2025</span>
        </div>
      </div>
    ),
  },
];

// ─── Main pitch component ────────────────────────────────────────────────────

export default function Pitch() {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const goTo = useCallback((idx: number) => {
    const el = containerRef.current?.children[idx] as HTMLElement;
    if (el) {
      isScrolling.current = true;
      el.scrollIntoView({ behavior: "smooth" });
      setCurrent(idx);
      setTimeout(() => { isScrolling.current = false; }, 800);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goTo(Math.min(current + 1, slides.length - 1));
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current) return;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Array.from(container.children).indexOf(entry.target as HTMLElement);
            if (idx !== -1) setCurrent(idx);
          }
        });
      },
      { threshold: 0.6, root: container }
    );
    Array.from(container.children).forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative bg-[#0a0a0a]">
      <Link to="/" className="fixed top-6 left-8 z-50 text-sm font-mono text-white/40 hover:text-white transition-colors flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        TOLLGATE
      </Link>

      <div className="fixed bottom-8 right-8 z-50 text-xs font-mono text-white/30">
        {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </div>
      <div className="fixed bottom-8 left-8 z-50 text-xs font-mono text-white/20 hidden md:block">↑ ↓ to navigate</div>

      {/* Dot nav */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {slides.map((s, i) => (
          <button key={s.id} onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{ width: 6, height: current === i ? 20 : 6, background: current === i ? ACCENT : "rgba(255,255,255,0.2)" }}
          />
        ))}
      </div>

      {current > 0 && (
        <button onClick={() => goTo(current - 1)}
          className="fixed left-8 top-1/2 -translate-y-1/2 z-50 w-10 h-10 flex items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 12L4 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {current < slides.length - 1 && (
        <button onClick={() => goTo(current + 1)}
          className="fixed right-16 bottom-8 z-50 w-10 h-10 flex items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <div ref={containerRef} className="h-screen overflow-y-auto snap-y snap-mandatory" style={{ scrollbarWidth: "none" }}>
        {slides.map((slide, i) => (
          <section key={slide.id}
            className="snap-start h-screen flex items-center justify-center px-8 md:px-16 lg:px-20 py-12 relative">
            <div className="w-full max-w-7xl">
              {slide.label && (
                <p className="text-sm font-mono tracking-widest uppercase mb-8 font-semibold" style={{ color: ACCENT }}>
                  {slide.label}
                </p>
              )}
              <AnimatePresence mode="wait">
                {current === i && (
                  <motion.div key={`${slide.id}-active`}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.4 }}
                  >
                    {slide.content}
                  </motion.div>
                )}
              </AnimatePresence>
              {current !== i && <div style={{ opacity: 0 }}>{slide.content}</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
