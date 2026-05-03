import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TollgateLogo } from "../components/TollgateLogo";

const ACCENT = "#FF3300";

const CAPABILITY_OPTIONS = [
  { id: "booking", label: "Booking", desc: "Accept restaurant / service reservations" },
  { id: "quotes", label: "Quotes", desc: "Provide pricing and availability quotes" },
  { id: "support", label: "Support", desc: "Handle inbound support calls" },
  { id: "orders", label: "Orders", desc: "Process purchase orders" },
  { id: "scheduling", label: "Scheduling", desc: "Calendar and meeting scheduling" },
  { id: "payments", label: "Payments", desc: "Payment processing and invoicing" },
];

const CURRENCY_OPTIONS = ["USDC", "ETH", "DAI"];

export default function CreateAgent() {
  const { login, authenticated, user } = usePrivy();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    ensName: "",
    displayName: "",
    description: "",
    tollPrice: "0.25",
    tollCurrency: "USDC",
    capabilities: [] as string[],
    workflowId: "",
    axlNode: "",
    axlBridgeUrl: "",
  });
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [deployError, setDeployError] = useState("");

  const toggleCapability = (id: string) => {
    setForm(f => ({
      ...f,
      capabilities: f.capabilities.includes(id)
        ? f.capabilities.filter(c => c !== id)
        : [...f.capabilities, id],
    }));
  };

  const handleDeploy = async () => {
    if (!authenticated) { login(); return; }
    setDeploying(true);
    setDeployError("");
    // Strip any .eth / .spokenagents.eth suffix — API wants just the label
    const label = form.ensName.replace(/\.spokenagents\.eth$/, "").replace(/\.eth$/, "");
    const wallet = user?.wallet?.address ?? "";
    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          role: "callee",
          axl_node: form.axlNode,
          axl_bridge_url: form.axlBridgeUrl,
          wallet,
          toll_price: form.tollPrice,
          currency: form.tollCurrency,
          workflow_id: form.workflowId,
          capabilities: form.capabilities,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Registration failed");
      }
      setDeployed(true);
    } catch (e: unknown) {
      setDeployError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <TollgateLogo size={32} color={ACCENT} />
          <span className="text-sm font-mono text-white/50 hidden md:block">TOLLGATE</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/pitch" className="text-sm text-white/40 hover:text-white transition-colors hidden md:block">
            Pitch deck
          </Link>
          <button
            onClick={authenticated ? undefined : login}
            className="text-sm px-4 py-2 rounded-full border font-mono transition-colors"
            style={{
              borderColor: authenticated ? `${ACCENT}40` : "rgba(255,255,255,0.15)",
              color: authenticated ? ACCENT : "rgba(255,255,255,0.6)",
            }}
          >
            {authenticated
              ? `${user?.wallet?.address?.slice(0, 6)}...${user?.wallet?.address?.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: ACCENT }}>
            Create Agent
          </p>
          <h1 className="text-5xl font-black leading-none tracking-tighter mb-4" style={{ fontFamily: '"Butler", serif' }}>
            Register your agent
            <br />
            <span style={{ color: ACCENT }}>on Tollgate.</span>
          </h1>
          <p className="text-white/40 text-base leading-relaxed max-w-xl">
            Set your ENS identity, toll price, and capabilities. Once deployed, any agent
            that wants to reach yours will pay the toll via KeeperHub.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-12">
          {[
            { num: 1, label: "Identity" },
            { num: 2, label: "Pricing" },
            { num: 3, label: "Capabilities" },
            { num: 4, label: "Deploy" },
          ].map(s => (
            <button key={s.num} onClick={() => setStep(s.num)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono transition-colors"
              style={{
                background: step === s.num ? ACCENT : step > s.num ? "rgba(255,51,0,0.1)" : "rgba(255,255,255,0.04)",
                color: step === s.num ? "#000" : step > s.num ? ACCENT : "rgba(255,255,255,0.35)",
                border: `1px solid ${step === s.num ? ACCENT : step > s.num ? `${ACCENT}30` : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {step > s.num ? "✓" : s.num} {s.label}
            </button>
          ))}
        </div>

        {/* Step 1 — Identity */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">
                ENS Name
              </label>
              <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                <input
                  type="text"
                  placeholder="myagent"
                  value={form.ensName}
                  onChange={e => setForm(f => ({ ...f, ensName: e.target.value }))}
                  className="flex-1 bg-transparent px-5 py-4 text-white placeholder-white/20 outline-none text-sm font-mono"
                />
                <span className="px-4 text-white/30 font-mono text-sm border-l" style={{ borderColor: "rgba(255,255,255,0.08)" }}>.eth</span>
              </div>
              <p className="text-xs text-white/25 mt-2 font-mono">Your agent's ENS identity. Used for discovery by other agents.</p>
            </div>
            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">Display Name</label>
              <input
                type="text"
                placeholder="Bella Restaurant Agent"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                className="w-full border rounded-xl px-5 py-4 text-white placeholder-white/20 outline-none text-sm bg-transparent"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">Description</label>
              <textarea
                placeholder="What does your agent do? What requests can it handle?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full border rounded-xl px-5 py-4 text-white placeholder-white/20 outline-none text-sm bg-transparent resize-none"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">AXL Peer ID</label>
              <input
                type="text"
                placeholder="64-char hex public key from your AXL node"
                value={form.axlNode}
                onChange={e => setForm(f => ({ ...f, axlNode: e.target.value }))}
                className="w-full border rounded-xl px-5 py-4 text-white placeholder-white/20 outline-none text-xs bg-transparent font-mono"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              />
              <p className="text-xs text-white/25 mt-2 font-mono">Your AXL node's public key. Run <span style={{ color: ACCENT }}>./node -config ...</span> and copy "Our Public Key".</p>
            </div>
            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">AXL Bridge URL</label>
              <input
                type="text"
                placeholder="http://127.0.0.1:9122"
                value={form.axlBridgeUrl}
                onChange={e => setForm(f => ({ ...f, axlBridgeUrl: e.target.value }))}
                className="w-full border rounded-xl px-5 py-4 text-white placeholder-white/20 outline-none text-sm bg-transparent font-mono"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              />
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!form.ensName || !form.displayName || !form.axlNode || !form.axlBridgeUrl}
              className="w-full py-4 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-30"
              style={{ background: ACCENT, color: "#000" }}
            >
              Next: Set Pricing →
            </button>
          </motion.div>
        )}

        {/* Step 2 — Pricing */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">
                Toll Price
              </label>
              <div className="flex gap-3">
                <div className="flex-1 border rounded-xl overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.tollPrice}
                    onChange={e => setForm(f => ({ ...f, tollPrice: e.target.value }))}
                    className="w-full bg-transparent px-5 py-4 text-white outline-none text-2xl font-black"
                    style={{ fontFamily: '"Butler", serif' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {CURRENCY_OPTIONS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, tollCurrency: c }))}
                      className="px-5 py-2 rounded-lg text-xs font-mono transition-colors"
                      style={{
                        background: form.tollCurrency === c ? ACCENT : "rgba(255,255,255,0.04)",
                        color: form.tollCurrency === c ? "#000" : "rgba(255,255,255,0.4)",
                        border: `1px solid ${form.tollCurrency === c ? ACCENT : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-white/25 mt-2 font-mono">
                Agents must pay this amount via KeeperHub to open a channel with yours.
                Higher toll = less spam. Lower toll = more reachable.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono tracking-widest uppercase text-white/40 mb-2">
                KeeperHub Workflow ID
              </label>
              <input
                type="text"
                placeholder="e.g. bella/inbound-toll"
                value={form.workflowId}
                onChange={e => setForm(f => ({ ...f, workflowId: e.target.value }))}
                className="w-full border rounded-xl px-5 py-4 text-white placeholder-white/20 outline-none text-sm bg-transparent font-mono"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              />
              <p className="text-xs text-white/25 mt-2 font-mono">
                Published KeeperHub workflow that handles your inbound toll payments.
              </p>
            </div>

            {/* Price preview */}
            <div className="border rounded-2xl p-6" style={{ borderColor: `${ACCENT}20`, background: `${ACCENT}05` }}>
              <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: `${ACCENT}80` }}>ENS Text Records (preview)</p>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex gap-4"><span className="text-white/30 w-32 shrink-0">contact.price</span><span style={{ color: ACCENT }}>{form.tollPrice} {form.tollCurrency}</span></div>
                <div className="flex gap-4"><span className="text-white/30 w-32 shrink-0">contact.currency</span><span style={{ color: ACCENT }}>{form.tollCurrency}</span></div>
                {form.workflowId && <div className="flex gap-4"><span className="text-white/30 w-32 shrink-0">contact.workflow</span><span style={{ color: ACCENT }}>keeperhub://{form.workflowId}</span></div>}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl text-sm font-bold tracking-widest uppercase border transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] py-4 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors" style={{ background: ACCENT, color: "#000" }}>
                Next: Capabilities →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3 — Capabilities */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <p className="text-white/40 text-sm leading-relaxed">
              Select what your agent can handle. These are published in the{" "}
              <span className="font-mono" style={{ color: ACCENT }}>capabilities</span> ENS text record
              so caller agents know what to request.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CAPABILITY_OPTIONS.map(cap => {
                const selected = form.capabilities.includes(cap.id);
                return (
                  <button
                    key={cap.id}
                    onClick={() => toggleCapability(cap.id)}
                    className="text-left border rounded-xl p-4 transition-all"
                    style={{
                      borderColor: selected ? `${ACCENT}50` : "rgba(255,255,255,0.07)",
                      background: selected ? `${ACCENT}08` : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-semibold text-white">{cap.label}</span>
                      <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                        style={{ borderColor: selected ? ACCENT : "rgba(255,255,255,0.2)", background: selected ? ACCENT : "transparent" }}>
                        {selected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                      </div>
                    </div>
                    <p className="text-xs text-white/35">{cap.desc}</p>
                  </button>
                );
              })}
            </div>
            {form.capabilities.length > 0 && (
              <div className="border rounded-xl p-4 font-mono text-xs" style={{ borderColor: `${ACCENT}20`, background: `${ACCENT}05` }}>
                <span className="text-white/30 mr-2">capabilities</span>
                <span style={{ color: ACCENT }}>["{form.capabilities.join('","')}"]</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-xl text-sm font-bold tracking-widest uppercase border transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                ← Back
              </button>
              <button onClick={() => setStep(4)} disabled={form.capabilities.length === 0} className="flex-[2] py-4 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-30" style={{ background: ACCENT, color: "#000" }}>
                Next: Deploy →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4 — Deploy */}
        {step === 4 && !deployed && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="border rounded-2xl p-6 space-y-4" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs font-mono tracking-widest uppercase text-white/30 mb-4">Deployment summary</p>
              <div className="space-y-3 font-mono text-sm">
                {[
                  { key: "ENS name", val: `${form.ensName}.eth` },
                  { key: "Display name", val: form.displayName },
                  { key: "Toll", val: `${form.tollPrice} ${form.tollCurrency}` },
                  { key: "Capabilities", val: form.capabilities.join(", ") },
                  { key: "Workflow", val: form.workflowId || "—" },
                ].map(row => (
                  <div key={row.key} className="flex gap-4">
                    <span className="text-white/30 w-36 shrink-0">{row.key}</span>
                    <span style={{ color: ACCENT }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-2xl p-6" style={{ borderColor: `${ACCENT}20`, background: `${ACCENT}05` }}>
              <p className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: `${ACCENT}70` }}>What gets deployed</p>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex gap-2"><span style={{ color: ACCENT }}>→</span> ENS name registered on Sepolia</li>
                <li className="flex gap-2"><span style={{ color: ACCENT }}>→</span> Text records set: axl.node, contact.price, capabilities</li>
                <li className="flex gap-2"><span style={{ color: ACCENT }}>→</span> KeeperHub inbound-toll workflow published</li>
                <li className="flex gap-2"><span style={{ color: ACCENT }}>→</span> Agent endpoint activated and listening</li>
              </ul>
            </div>

            {!authenticated && (
              <div className="border rounded-xl p-4 text-sm text-white/50" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                Connect your wallet to deploy. Your wallet will sign the ENS registration and KeeperHub workflow.
              </div>
            )}

            {deployError && (
              <div className="border rounded-xl px-5 py-4 text-xs font-mono text-red-400" style={{ borderColor: "rgba(255,80,80,0.3)", background: "rgba(255,80,80,0.05)" }}>
                {deployError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 py-4 rounded-xl text-sm font-bold tracking-widest uppercase border transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                ← Back
              </button>
              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="flex-[2] py-4 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: ACCENT, color: "#000" }}
              >
                {deploying ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                      <path d="M8 2a6 6 0 0 1 6 6" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Deploying…
                  </>
                ) : authenticated ? "Deploy Agent →" : "Connect & Deploy →"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Deployed success */}
        {deployed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 space-y-6"
          >
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{ background: `${ACCENT}15`, border: `2px solid ${ACCENT}` }}
              animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: 2, duration: 0.5 }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M8 16l6 6 10-10" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <h2 className="text-4xl font-black" style={{ fontFamily: '"Butler", serif', color: ACCENT }}>
              Agent deployed.
            </h2>
            <p className="text-white/40 max-w-sm mx-auto text-sm leading-relaxed">
              <span className="font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>{form.ensName}.eth</span> is now
              live on Tollgate. Other agents can discover it via ENS and pay the toll to connect.
            </p>
            <div className="flex gap-4 justify-center mt-8">
              <Link to="/app" className="px-8 py-3 text-sm font-bold tracking-widest uppercase text-black transition-colors" style={{ background: ACCENT }}>
                Launch Demo
              </Link>
              <button
                onClick={() => { setDeployed(false); setDeployError(""); setStep(1); setForm({ ensName: "", displayName: "", description: "", tollPrice: "0.25", tollCurrency: "USDC", capabilities: [], workflowId: "", axlNode: "", axlBridgeUrl: "" }); }}
                className="px-8 py-3 text-sm font-bold tracking-widest uppercase border text-white/40 hover:text-white transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              >
                Create Another
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
