import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const ACCENT = "#FF3300";

// ─── Animated SVG visuals ──────────────────────────────────────────────────

function TollgateLogoLarge() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
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
    <svg viewBox="0 0 500 280" className="w-full max-w-lg" fill="none">
      {[{ x: 28, y: 44 }, { x: 28, y: 110 }, { x: 28, y: 176 }, { x: 28, y: 242 }, { x: 78, y: 77 }, { x: 78, y: 209 }].map((pos, i) => (
        <g key={i}>
          <rect x={pos.x} y={pos.y - 16} width={58} height={32} rx={6} fill="#1a1a1a" stroke="rgba(255,51,0,0.3)" strokeWidth={1} />
          <text x={pos.x + 29} y={pos.y + 4} textAnchor="middle" fontSize={9} fill="#FF3300" fontFamily="monospace">SPAM</text>
          <motion.line x1={pos.x + 58} y1={pos.y} x2={210} y2={140}
            stroke="#FF3300" strokeWidth={1} strokeDasharray="4 3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.4 }}
            transition={{ delay: i * 0.15, duration: 0.8 }}
          />
        </g>
      ))}
      <motion.rect x={200} y={112} width={80} height={56} rx={8} fill="#1a1a1a"
        stroke="rgba(255,51,0,0.6)" strokeWidth={2}
        animate={{ stroke: ["rgba(255,51,0,0.4)", "rgba(255,51,0,0.9)", "rgba(255,51,0,0.4)"] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      <text x={240} y={138} textAnchor="middle" fontSize={10} fill="white" fontFamily="monospace">bella.eth</text>
      <text x={240} y={153} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="monospace">OVERWHELMED</text>
      <text x={120} y={270} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.3)" fontFamily="monospace">Cost to send: $0.001</text>
      <text x={340} y={270} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.3)" fontFamily="monospace">Cost to receive: $0.10+</text>
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
    <svg viewBox="0 0 520 260" className="w-full max-w-lg" fill="none">
      <rect x={20} y={95} width={90} height={50} rx={8} fill="#1a1a1a" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={65} y={116} textAnchor="middle" fontSize={10} fill="white" fontFamily="monospace">alex.eth</text>
      <text x={65} y={132} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="monospace">caller</text>

      <motion.rect x={200} y={85} width={120} height={70} rx={10} fill="#0a0a0a"
        stroke={ACCENT} strokeWidth={2}
        animate={{ strokeOpacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2 }}
      />
      <text x={260} y={113} textAnchor="middle" fontSize={12} fill={ACCENT} fontFamily="serif" fontWeight={700}>TOLLGATE</text>
      <text x={260} y={128} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="monospace">ENS + KeeperHub + AXL</text>
      <text x={260} y={142} textAnchor="middle" fontSize={8} fill="rgba(255,51,0,0.7)" fontFamily="monospace">$0.25 toll</text>

      <rect x={410} y={95} width={90} height={50} rx={8} fill="#1a1a1a" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={455} y={116} textAnchor="middle" fontSize={10} fill="white" fontFamily="monospace">bella.eth</text>
      <text x={455} y={132} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="monospace">callee</text>

      <motion.line x1={110} y1={120} x2={200} y2={120}
        stroke={step >= 1 ? ACCENT : "rgba(255,255,255,0.1)"} strokeWidth={2} strokeDasharray="6 3"
        animate={{ opacity: 1 }} />
      <motion.line x1={320} y1={120} x2={410} y2={120}
        stroke={step >= 2 ? "#00FF88" : "rgba(255,255,255,0.1)"} strokeWidth={2} strokeDasharray="6 3"
        animate={{ opacity: step >= 2 ? 1 : 0.2 }} transition={{ duration: 0.4 }} />

      <rect x={160} y={190} width={200} height={26} rx={13} fill="#1a1a1a" />
      <AnimatePresence mode="wait">
        <motion.text key={step} x={260} y={207} textAnchor="middle" fontSize={10}
          fill={colors[step]} fontFamily="monospace"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {`0${step + 1} — ${steps[step]}`}
        </motion.text>
      </AnimatePresence>

      <motion.circle cx={260} cy={46} r={6} fill={ACCENT}
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      <text x={260} y={68} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.25)" fontFamily="monospace">LIVE</text>
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
    <svg viewBox="0 0 500 240" className="w-full max-w-lg" fill="none">
      <rect x={20} y={75} width={80} height={90} rx={8} fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={60} y={100} textAnchor="middle" fontSize={9} fill="white" fontFamily="monospace">alex.eth</text>
      <text x={60} y={114} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.3)" fontFamily="monospace">AXL node</text>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.rect key={i} x={30 + i * 11} y={130} width={8} rx={4} fill={ACCENT}
          animate={{ height: [4, 18 + i * 3, 4], y: [144, 130 - i * 1.5, 144] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
        />
      ))}

      <rect x={400} y={75} width={80} height={90} rx={8} fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={440} y={100} textAnchor="middle" fontSize={9} fill="white" fontFamily="monospace">bella.eth</text>
      <text x={440} y={114} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.3)" fontFamily="monospace">AXL node</text>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.rect key={i} x={406 + i * 11} y={130} width={8} rx={4} fill="#00FF88"
          animate={{ height: [4, 14 + i * 2.5, 4], y: [144, 132 - i * 1.2, 144] }}
          transition={{ repeat: Infinity, duration: 1.0, delay: i * 0.12 }}
        />
      ))}

      <rect x={148} y={103} width={204} height={38} rx={19} fill="#1a1a1a" stroke="rgba(255,255,255,0.07)" />
      <AnimatePresence mode="wait">
        <motion.text key={active} x={250} y={127} textAnchor="middle" fontSize={11}
          fill={msgColors[active]} fontFamily="monospace" fontWeight={600}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {messages[active]}
        </motion.text>
      </AnimatePresence>
      <text x={250} y={76} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.2)" fontFamily="monospace">
        AXL P2P CHANNEL — ENCRYPTED
      </text>
      {[0, 1, 2].map(i => (
        <motion.circle key={i} cx={210 + i * 20} cy={168} r={3} fill={ACCENT}
          animate={{ opacity: active === i ? [0.3, 1, 0.3] : 0.15, scale: active === i ? [1, 1.5, 1] : 1 }}
          transition={{ duration: 0.4 }}
        />
      ))}
      <text x={250} y={192} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.2)" fontFamily="monospace">
        ◈ chirps synced to message traffic ◈
      </text>
    </svg>
  );
}

function ArchitectureSVG() {
  return (
    <svg viewBox="0 0 520 300" className="w-full max-w-2xl" fill="none">
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <rect x={20} y={20} width={110} height={60} rx={10} fill="#0d1a3a" stroke="#5298FF30" strokeWidth={1.5} />
        <text x={75} y={47} textAnchor="middle" fontSize={12} fill="#5298FF" fontFamily="serif" fontWeight={700}>ENS</text>
        <text x={75} y={63} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">Directory</text>
      </motion.g>
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <rect x={205} y={20} width={110} height={60} rx={10} fill="#2a0a00" stroke={`${ACCENT}30`} strokeWidth={1.5} />
        <text x={260} y={47} textAnchor="middle" fontSize={10} fill={ACCENT} fontFamily="serif" fontWeight={700}>KeeperHub</text>
        <text x={260} y={63} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">Payments</text>
      </motion.g>
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <rect x={390} y={20} width={110} height={60} rx={10} fill="#003a1a" stroke="#00FF8830" strokeWidth={1.5} />
        <text x={445} y={47} textAnchor="middle" fontSize={12} fill="#00FF88" fontFamily="serif" fontWeight={700}>AXL</text>
        <text x={445} y={63} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">P2P Transport</text>
      </motion.g>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <rect x={40} y={150} width={100} height={55} rx={8} fill="#1a1a1a" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <text x={90} y={174} textAnchor="middle" fontSize={10} fill="white" fontFamily="monospace">alex.eth</text>
        <text x={90} y={189} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">caller agent</text>
      </motion.g>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <rect x={380} y={150} width={100} height={55} rx={8} fill="#1a1a1a" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <text x={430} y={174} textAnchor="middle" fontSize={10} fill="white" fontFamily="monospace">bella.eth</text>
        <text x={430} y={189} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">callee agent</text>
      </motion.g>
      <motion.path d="M90 150 L75 80" stroke="#5298FF" strokeWidth={1} strokeDasharray="4 3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7, duration: 0.5 }} />
      <motion.path d="M140 178 L205 50" stroke={ACCENT} strokeWidth={1} strokeDasharray="4 3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 0.5 }} />
      <motion.path d="M90 150 Q260 110 445 150" stroke="#00FF88" strokeWidth={1} strokeDasharray="6 3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 0.8 }} />
      <motion.path d="M430 150 L75 80" stroke="#5298FF" strokeWidth={1} strokeDasharray="4 3" opacity={0.35}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.5 }} />
      <motion.path d="M380 178 L315 80" stroke={ACCENT} strokeWidth={1} strokeDasharray="4 3" opacity={0.35}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.0, duration: 0.5 }} />
      <text x={260} y={278} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.18)" fontFamily="monospace">
        All three sponsors are load-bearing. None are decorative.
      </text>
    </svg>
  );
}

function MarketSVG() {
  const bars = [
    { label: "2024", val: 15, color: "rgba(255,255,255,0.18)" },
    { label: "2025", val: 38, color: "rgba(255,255,255,0.3)" },
    { label: "2026", val: 72, color: ACCENT },
    { label: "2027", val: 160, color: ACCENT },
    { label: "2028", val: 310, color: ACCENT },
  ];
  return (
    <svg viewBox="0 0 400 210" className="w-full max-w-md" fill="none">
      <text x={200} y={16} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.28)" fontFamily="monospace">AGENT-TO-AGENT CALLS (indexed)</text>
      {bars.map((b, i) => {
        const h = (b.val / 310) * 145;
        return (
          <g key={i}>
            <motion.rect x={30 + i * 72} y={175 - h} width={48} height={h} rx={4} fill={b.color}
              initial={{ height: 0, y: 175 }} animate={{ height: h, y: 175 - h }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
            />
            <text x={54 + i * 72} y={192} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.35)" fontFamily="monospace">{b.label}</text>
            <motion.text x={54 + i * 72} y={175 - h - 6} textAnchor="middle" fontSize={9} fill={b.color} fontFamily="monospace"
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
      <div className="flex flex-col items-center justify-center text-center h-full gap-8 relative">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}>
          <TollgateLogoLarge />
        </motion.div>
        <motion.h1
          className="text-7xl md:text-9xl font-black tracking-tighter leading-none"
          style={{ fontFamily: '"Butler", serif', color: ACCENT, fontWeight: 900 }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          TOLLGATE
        </motion.h1>
        <motion.p className="text-xl md:text-2xl text-white/60 max-w-lg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        >
          Stripe for agent-to-agent calls.
        </motion.p>
        <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {["Gensyn AXL", "KeeperHub", "ENS"].map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full border text-xs font-mono" style={{ borderColor: `${ACCENT}40`, color: `${ACCENT}90` }}>{tag}</span>
          ))}
        </motion.div>
        <motion.div className="absolute bottom-8 flex flex-col items-center"
          animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12l7 7 7-7" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
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
          <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter mb-6 text-white" style={{ fontFamily: '"Butler", serif' }}>
            AI robocalls are<br /><span style={{ color: ACCENT }}>inevitable.</span>
          </h2>
          <ul className="space-y-4 text-white/50 text-sm max-w-md">
            {["Every business will have a voice agent", "LLM calls cost fractions of a cent to generate", "Any agent can call any agent, at infinite scale, for free", "No postage. No rate-limiting. No toll booth. Yet."]
              .map(txt => <li key={txt} className="flex gap-3"><span style={{ color: ACCENT }}>×</span>{txt}</li>)}
          </ul>
        </div>
        <div className="flex-shrink-0"><AgentSpamSVG /></div>
      </div>
    ),
  },
  {
    id: "why-now", label: "02 — Why Now",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl font-black leading-none tracking-tighter mb-6 text-white" style={{ fontFamily: '"Butler", serif' }}>
            The window is<br /><span style={{ color: ACCENT }}>right now.</span>
          </h2>
          <div className="grid gap-4 max-w-sm">
            {[
              { num: "01", title: "Agents are proliferating", desc: "OpenAI, Anthropic, every Fortune 500 shipping voice agents in 2025." },
              { num: "02", title: "x402 is production-ready", desc: "HTTP-native micropayments over EVM chains. No extra infra." },
              { num: "03", title: "ENS is the directory", desc: "A global, open, censorship-resistant agent registry already exists." },
            ].map(item => (
              <div key={item.num} className="border rounded-xl p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                <span className="text-xs font-mono" style={{ color: ACCENT }}>{item.num}</span>
                <p className="text-white font-semibold text-sm mt-1">{item.title}</p>
                <p className="text-white/40 text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0"><MarketSVG /></div>
      </div>
    ),
  },
  {
    id: "solution", label: "03 — Solution",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl font-black leading-none tracking-tighter mb-4 text-white" style={{ fontFamily: '"Butler", serif' }}>
            To reach an agent,<br /><span style={{ color: ACCENT }}>another agent pays.</span>
          </h2>
          <div className="border-l-2 pl-4 my-6 italic text-white/50 text-base max-w-xs" style={{ borderColor: ACCENT }}>
            "The toll booth that should've been built before the highway."
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[{ stat: "$0.25", label: "avg toll" }, { stat: "30s", label: "end-to-end" }, { stat: "100%", label: "on-chain audit" }].map(s => (
              <div key={s.stat} className="text-center">
                <div className="text-3xl font-black" style={{ fontFamily: '"Butler", serif', color: ACCENT }}>{s.stat}</div>
                <div className="text-xs font-mono text-white/30 tracking-widest uppercase mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0"><TollgateDiagramSVG /></div>
      </div>
    ),
  },
  {
    id: "protocol", label: "04 — Protocol",
    content: (
      <div className="flex flex-col lg:flex-row items-center gap-12 h-full">
        <div className="flex-1">
          <h2 className="text-5xl font-black leading-none tracking-tighter mb-8 text-white" style={{ fontFamily: '"Butler", serif' }}>
            Six phases.<br />One paid channel.
          </h2>
          <div className="space-y-3 max-w-sm">
            {[
              { num: "01", label: "Discovery", detail: "bella.eth → AXL node + toll via ENS" },
              { num: "02", label: "Voice greeting", detail: "LiveKit, agent-to-agent detection" },
              { num: "03", label: "Toll payment", detail: "USDC via KeeperHub + modem sweep" },
              { num: "04", label: "AXL channel", detail: "P2P encrypted, verified by receipt" },
              { num: "05", label: "Negotiation", detail: "PROPOSE → ACCEPT → CONFIRM" },
              { num: "06", label: "Settlement", detail: "KeeperHub deposit + audit trail" },
            ].map((step, i) => (
              <motion.div key={step.num} className="flex gap-4 items-start"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
              >
                <span className="text-xs font-mono shrink-0 w-6 pt-0.5" style={{ color: ACCENT }}>{step.num}</span>
                <div>
                  <span className="text-sm font-semibold text-white">{step.label}</span>
                  <span className="text-xs text-white/30 ml-2">{step.detail}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0"><AXLFlowSVG /></div>
      </div>
    ),
  },
  {
    id: "technology", label: "05 — Technology",
    content: (
      <div className="h-full flex flex-col gap-8">
        <h2 className="text-5xl font-black leading-none tracking-tighter text-white" style={{ fontFamily: '"Butler", serif' }}>
          All three sponsors are <span style={{ color: ACCENT }}>load-bearing.</span>
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <ArchitectureSVG />
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          {[
            { name: "ENS", color: "#5298FF", desc: "Agent directory — AXL node, toll price, capabilities as text records." },
            { name: "KeeperHub", color: ACCENT, desc: "x402 toll + settlement with MEV protection and full audit trail." },
            { name: "Gensyn AXL", color: "#00FF88", desc: "Encrypted P2P negotiation — PROPOSE/ACCEPT/CONFIRM messages." },
          ].map(t => (
            <div key={t.name} className="border rounded-xl p-4" style={{ borderColor: `${t.color}25`, background: `${t.color}05` }}>
              <p className="font-bold text-sm mb-1" style={{ color: t.color }}>{t.name}</p>
              <p className="text-white/35 text-xs leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "demo", label: "06 — Demo",
    content: (
      <div className="h-full flex flex-col gap-8">
        <h2 className="text-5xl font-black leading-none tracking-tighter text-white" style={{ fontFamily: '"Butler", serif' }}>
          "Book me a table<br /><span style={{ color: ACCENT }}>at Bella."</span>
        </h2>
        <div className="grid grid-cols-2 gap-6 max-w-3xl">
          {[
            { num: "01", title: "Cold open", desc: "Alex's agent: 'Book me Bella, Friday, party of 4, up to $25.'" },
            { num: "02", title: "Spam demo", desc: "Unpaid call rejected at gate. This is why we built this." },
            { num: "03", title: "ENS resolves", desc: "bella.eth → toll $0.25 USDC. KeeperHub tx confirmed. Modem sweep." },
            { num: "04", title: "AXL negotiation", desc: "Chirps. PROPOSE → ACCEPT. Sub-second. Table Friday 8pm, $20 deposit." },
          ].map(s => (
            <div key={s.num} className="border rounded-2xl p-6" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <div className="text-xs font-mono mb-2" style={{ color: ACCENT }}>{s.num}</div>
              <p className="text-white font-semibold text-sm mb-2">{s.title}</p>
              <p className="text-white/40 text-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-mono">
          {[{ label: "✓ AXL two-node deployment", color: "#00FF88" }, { label: "✓ KeeperHub toll + settlement", color: ACCENT }, { label: "✓ ENS text record resolution", color: "#5298FF" }]
            .map(b => <span key={b.label} style={{ color: b.color }}>{b.label}</span>)}
        </div>
      </div>
    ),
  },
  {
    id: "prizes", label: "07 — Prize Tracks",
    content: (
      <div className="h-full flex flex-col gap-8">
        <h2 className="text-5xl font-black leading-none tracking-tighter text-white" style={{ fontFamily: '"Butler", serif' }}>
          Three tracks.<br /><span style={{ color: ACCENT }}>$17k exposure.</span>
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            { sponsor: "Gensyn", prize: "$5,000", color: "#00FF88", track: "Best Application of AXL", proof: "Two AXL nodes. Full PROPOSE→CONFIRM over AXL. No central broker." },
            { sponsor: "KeeperHub", prize: "$4,750", color: ACCENT, track: "Best Use + Feedback Bounty", proof: "x402 toll + settlement workflows. Public inbound-toll workflow. FEEDBACK.md." },
            { sponsor: "ENS", prize: "$5,000", color: "#5298FF", track: "Best Integration + Most Creative", proof: "contact.price as novel ENS pattern. Without ENS, there's no directory." },
          ].map(p => (
            <div key={p.sponsor} className="border rounded-2xl p-6" style={{ borderColor: `${p.color}25`, background: `${p.color}05` }}>
              <div className="text-3xl font-black mb-1" style={{ fontFamily: '"Butler", serif', color: p.color }}>{p.prize}</div>
              <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: `${p.color}70` }}>{p.sponsor}</div>
              <p className="text-white text-sm font-semibold mb-2">{p.track}</p>
              <p className="text-white/35 text-xs leading-relaxed">{p.proof}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-white/25">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }}></span>
          ETHGlobal Open Agents — May 2025
        </div>
      </div>
    ),
  },
  {
    id: "close", label: "08 — Build with us",
    content: (
      <div className="flex flex-col items-center justify-center text-center h-full gap-8 relative">
        <h2 className="text-7xl md:text-8xl font-black tracking-tighter leading-none" style={{ fontFamily: '"Butler", serif', color: ACCENT }}>
          The toll booth<br />is open.
        </h2>
        <p className="text-xl text-white/50 max-w-xl">
          Every agent-to-agent call, everywhere, paying its way.
          Tollgate is the primitive the next decade needs.
        </p>
        <div className="flex gap-4 mt-4">
          <Link to="/app" className="px-8 py-3 text-sm font-bold tracking-widest uppercase text-black transition-colors hover:opacity-90"
            style={{ background: ACCENT }}>
            Try the demo →
          </Link>
          <Link to="/create-agent" className="px-8 py-3 text-sm font-bold tracking-widest uppercase border border-white/20 text-white hover:bg-white/5 transition-colors">
            Create an Agent
          </Link>
        </div>
        <div className="absolute bottom-8 flex gap-8 text-xs font-mono text-white/20">
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
          <section key={slide.id} className="snap-start h-screen flex items-center justify-center px-12 md:px-20 py-16 relative">
            <div className="w-full max-w-6xl">
              {slide.label && (
                <p className="text-xs font-mono tracking-widest uppercase mb-6" style={{ color: ACCENT }}>
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
