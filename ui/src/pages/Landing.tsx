import { usePrivy } from "@privy-io/react-auth";
import { Link } from "react-router-dom";
import { TollgateLogo } from "../components/TollgateLogo";

function Nav() {
  const { login, authenticated, logout } = usePrivy();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between px-8 pt-6">
      <Link to="/" className="text-current">
        <TollgateLogo />
      </Link>
      <div className="hidden md:grid grid-cols-3 gap-x-16 text-sm font-medium tracking-wide">
        <div className="flex flex-col">
          <a href="#how-it-works" className="border-b border-current pb-1 mb-3 hover:opacity-70 transition-opacity">
            How it works
          </a>
          <a href="#technology" className="hover:opacity-70 transition-opacity">
            Technology
          </a>
        </div>
        <div className="flex flex-col">
          <Link to="/pitch" className="border-b border-current pb-1 mb-3 hover:opacity-70 transition-opacity">
            Pitch deck
          </Link>
          <Link to="/app" className="hover:opacity-70 transition-opacity">
            Demo app
          </Link>
        </div>
        <div className="flex flex-col">
          <Link to="/create-agent" className="border-b border-current pb-1 mb-3 hover:opacity-70 transition-opacity flex items-center gap-1">
            Create Agent ↗
          </Link>
          <button
            onClick={authenticated ? logout : login}
            className="text-left hover:opacity-70 transition-opacity"
          >
            {authenticated ? "Wallet ↗" : "Connect"}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function Landing() {
  const { login, authenticated } = usePrivy();

  return (
    <div className="bg-white">
      <Nav />

      {/* Hero — full viewport orange */}
      <section className="relative min-h-screen bg-[#FF3300] text-black flex flex-col justify-end overflow-hidden">
        <div className="px-8 pb-0 pt-32">
          <p className="text-sm font-medium tracking-widest uppercase mb-6 opacity-70">
            ETHGlobal Open Agents — 2025
          </p>
          <div className="text-right mb-2 text-base md:text-lg font-medium">
            Build the toll booth with
          </div>
        </div>
        <div className="overflow-hidden">
          <h1
            className="text-[22vw] leading-[0.82] font-black tracking-tighter uppercase select-none"
            style={{ fontFamily: '"Butler", serif', fontWeight: 900 }}
          >
            TOLLGATE
          </h1>
        </div>
      </section>

      {/* Tagline band */}
      <section className="bg-black text-white px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <p className="text-2xl md:text-4xl font-bold max-w-2xl leading-tight" style={{ fontFamily: '"Butler", serif' }}>
          Stripe for agent-to-agent calls.
        </p>
        <div className="flex gap-4">
          <button
            onClick={login}
            className="bg-[#FF3300] text-black px-8 py-3 text-sm font-bold tracking-wide uppercase hover:bg-[#cc2900] transition-colors"
          >
            {authenticated ? "Open App →" : "Get started →"}
          </button>
          <Link
            to="/pitch"
            className="border border-white/30 text-white px-8 py-3 text-sm font-medium tracking-wide uppercase hover:bg-white/5 transition-colors"
          >
            Pitch deck
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="bg-[#0a0a0a] text-white px-8 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-mono tracking-widest uppercase text-[#FF3300] mb-8">01 — The Problem</p>
          <h2
            className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-12 max-w-4xl"
            style={{ fontFamily: '"Butler", serif' }}
          >
            AI robocalls are coming. Nobody built a toll booth.
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {[
              { stat: "∞", label: "Cost to spam", desc: "LLM calls cost fractions of a cent. Any agent can call any agent, at any scale, for free." },
              { stat: "0", label: "Defenses today", desc: "No postage. No rate-limiting. No Stripe-for-agents. The toll booth doesn't exist yet." },
              { stat: "30s", label: "To settle a deal", desc: "With Tollgate: ENS discovery → KeeperHub toll → AXL negotiation → settlement." },
            ].map((item) => (
              <div key={item.stat} className="border border-white/10 bg-white/[0.02] p-8 rounded-2xl">
                <div className="text-5xl font-black text-[#FF3300] mb-2" style={{ fontFamily: '"Butler", serif' }}>
                  {item.stat}
                </div>
                <div className="text-sm font-mono tracking-widest uppercase text-white/40 mb-3">{item.label}</div>
                <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#FF3300] text-black px-8 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-mono tracking-widest uppercase opacity-60 mb-8">02 — How it works</p>
          <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter mb-16" style={{ fontFamily: '"Butler", serif' }}>
            Six phases.<br />One paid channel.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { num: "01", title: "Discovery", desc: "Alex's agent resolves bella.eth via ENS → AXL node, toll price, KeeperHub workflow." },
              { num: "02", title: "Voice greeting", desc: "Voice call over LiveKit. Both agents detect each other as AI." },
              { num: "03", title: "Toll payment", desc: "USDC via KeeperHub MCP. Retry, gas optimization, MEV-protected. Modem sweep plays." },
              { num: "04", title: "AXL channel", desc: "Toll receipt verified. Both AXL nodes connect. Encrypted P2P, no central broker." },
              { num: "05", title: "Negotiation", desc: "PROPOSE → COUNTER → ACCEPT → CONFIRM over AXL. R2-D2 chirps play." },
              { num: "06", title: "Settlement", desc: "KeeperHub executes deposit. Chime plays. Both agents report back to humans." },
            ].map((step) => (
              <div key={step.num} className="border border-black/20 bg-black/5 p-6 rounded-xl">
                <div className="text-xs font-mono tracking-widest uppercase opacity-50 mb-3">{step.num}</div>
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: '"Butler", serif' }}>{step.title}</h3>
                <p className="text-sm opacity-70 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section id="technology" className="bg-black text-white px-8 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-mono tracking-widest uppercase text-[#FF3300] mb-8">03 — Technology</p>
          <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter mb-16" style={{ fontFamily: '"Butler", serif' }}>
            Three sponsors.<br />All load-bearing.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "ENS", role: "Identity & Discovery", desc: "Every agent has a .eth name. Text records publish AXL node, toll price, capabilities, and KeeperHub workflow pointer.", color: "#5298FF" },
              { name: "KeeperHub", role: "Payments & Settlement", desc: "x402 payments on every channel open. Retry, gas optimization, MEV-protected. Publishes inbound-toll workflow for others.", color: "#FF3300" },
              { name: "Gensyn AXL", role: "Negotiation Transport", desc: "Two separate AXL nodes per call. All PROPOSE/COUNTER/ACCEPT/CONFIRM over AXL. Encrypted, P2P, no central broker.", color: "#00FF88" },
            ].map((tech) => (
              <div key={tech.name} className="border p-8 rounded-2xl" style={{ borderColor: `${tech.color}30`, backgroundColor: `${tech.color}05` }}>
                <div className="text-3xl font-black mb-1" style={{ fontFamily: '"Butler", serif', color: tech.color }}>{tech.name}</div>
                <div className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: `${tech.color}80` }}>{tech.role}</div>
                <p className="text-white/50 text-sm leading-relaxed">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo */}
      <section className="bg-[#0a0a0a] text-white px-8 py-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-mono tracking-widest uppercase text-[#FF3300] mb-8">04 — Demo</p>
            <h2 className="text-5xl font-black leading-none tracking-tighter mb-6" style={{ fontFamily: '"Butler", serif' }}>
              "Book me a table at Bella for Friday."
            </h2>
            <p className="text-white/50 text-base leading-relaxed mb-8">
              A two-agent booking demo in 2:45. One pays the toll. One receives it.
              ENS resolves. KeeperHub routes. AXL negotiates. Chirps play. Table held.
            </p>
            <div className="flex gap-4">
              <Link to="/app" className="inline-block bg-[#FF3300] text-black px-8 py-3 text-sm font-bold tracking-wide uppercase hover:bg-[#cc2900] transition-colors">
                Launch demo →
              </Link>
              <Link to="/pitch" className="inline-block border border-white/20 text-white px-8 py-3 text-sm font-medium tracking-wide uppercase hover:bg-white/5 transition-colors">
                Pitch deck
              </Link>
            </div>
          </div>
          <div className="font-mono text-sm space-y-0">
            {[
              { time: "0:00", label: "Alex: 'Book me a table at Bella, Friday, party of 4.'" },
              { time: "0:15", label: "Spam demo: unpaid call rejected at the gate." },
              { time: "0:30", label: "ENS resolves bella.eth → toll $0.25 USDC" },
              { time: "1:00", label: "KeeperHub tx confirmed. Modem sweep plays. ████" },
              { time: "1:20", label: "AXL open. PROPOSE → ACCEPT. Chirps. ◈ ◈ ◈" },
              { time: "1:50", label: "Settlement. Chime. Confirmation #BELLA-FRI-8PM" },
              { time: "2:10", label: "Both agents report to their humans." },
            ].map((item) => (
              <div key={item.time} className="flex gap-6 py-3 border-b border-white/5">
                <span className="text-[#FF3300] shrink-0 w-10">{item.time}</span>
                <span className="text-white/50">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#FF3300] text-black px-8 py-24 md:py-32">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <h2 className="text-6xl md:text-8xl font-black leading-none tracking-tighter" style={{ fontFamily: '"Butler", serif' }}>
            The toll booth<br />is open.
          </h2>
          <div className="flex flex-col gap-4">
            <Link to="/create-agent" className="bg-black text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-[#1a1a1a] transition-colors text-center">
              Create an Agent →
            </Link>
            <Link to="/pitch" className="border-2 border-black text-black px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-black/10 transition-colors text-center">
              View Pitch Deck
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white px-8 py-12 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <TollgateLogo color="#FF3300" />
            <p className="text-white/40 text-sm mt-3">ETHGlobal Open Agents 2025</p>
            <p className="text-white/20 text-xs mt-1 font-mono">Gensyn AXL + KeeperHub + ENS</p>
          </div>
          <div className="flex gap-8 text-sm text-white/40">
            <a href="#" className="hover:text-white transition-colors">GitHub ↗</a>
            <Link to="/pitch" className="hover:text-white transition-colors">Pitch deck</Link>
            <Link to="/create-agent" className="hover:text-white transition-colors">Create Agent</Link>
            <Link to="/app" className="hover:text-white transition-colors">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
