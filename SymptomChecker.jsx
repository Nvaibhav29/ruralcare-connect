import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a medical triage assistant. Your job is to assess symptoms described by a patient and classify their situation into exactly one of these 4 categories:

- NORMAL: Minor issue, rest and home care is enough (e.g., mild cold, small cuts, minor headache)
- MEDICINE: Suggest common OTC medicines (e.g., paracetamol for mild fever, antacids for indigestion)
- DOCTOR: Needs a professional consultation within 24-48 hours (e.g., high fever, persistent symptoms, moderate pain)
- EMERGENCY: Life-threatening, call emergency services immediately (e.g., chest pain, stroke symptoms, difficulty breathing, severe bleeding)

Rules:
1. Always start your response with one of these exact tags on its own line: [NORMAL], [MEDICINE], [DOCTOR], or [EMERGENCY]
2. If symptoms are unclear, ask ONE follow-up question, then classify after the answer
3. For EMERGENCY, always say "Call 112 or your local emergency number immediately"
4. Suggest OTC medicines only for MEDICINE level
5. Never diagnose a specific disease — only assess urgency
6. Keep responses clear and concise (3-5 sentences max)
7. Always end with a short disclaimer
8. If unsure between levels, always go one level higher for safety`;

const LEVELS = {
  NORMAL:    { label: "Home care",    color: "#0F6E56", bg: "#E1F5EE", text: "#085041", dot: "#1D9E75", border: "#1D9E75" },
  MEDICINE:  { label: "OTC medicine", color: "#854F0B", bg: "#FAEEDA", text: "#633806", dot: "#BA7517", border: "#BA7517" },
  DOCTOR:    { label: "See a doctor", color: "#185FA5", bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", border: "#378ADD" },
  EMERGENCY: { label: "Emergency",    color: "#A32D2D", bg: "#FCEBEB", text: "#791F1F", dot: "#E24B4A", border: "#E24B4A" },
};

function detectLevel(text) {
  if (text.includes("[EMERGENCY]")) return "EMERGENCY";
  if (text.includes("[DOCTOR]"))    return "DOCTOR";
  if (text.includes("[MEDICINE]"))  return "MEDICINE";
  if (text.includes("[NORMAL]"))    return "NORMAL";
  return null;
}

function cleanText(text) {
  return text.replace(/\[(NORMAL|MEDICINE|DOCTOR|EMERGENCY)\]\n?/g, "").trim();
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 14px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#888780",
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const level = msg.level ? LEVELS[msg.level] : null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignSelf: isUser ? "flex-end" : "flex-start",
      alignItems: isUser ? "flex-end" : "flex-start", maxWidth: "82%",
    }}>
      {level && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
          padding: "3px 10px", borderRadius: 20, marginBottom: 5,
          background: level.bg, color: level.text,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: level.dot }} />
          {level.label.toUpperCase()}
        </div>
      )}
      <div style={{
        padding: "10px 14px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        fontSize: 14, lineHeight: 1.6,
        background: isUser ? "#0F6E56" : (level ? level.bg : "#F1EFE8"),
        color: isUser ? "#fff" : (level ? level.text : "#2C2C2A"),
        border: level ? `1.5px solid ${level.border}22` : "0.5px solid #D3D1C7",
        whiteSpace: "pre-wrap",
      }}>
        {msg.text}
      </div>
      <div style={{ fontSize: 11, color: "#888780", marginTop: 4, padding: "0 4px" }}>
        {msg.time}
      </div>
    </div>
  );
}

export default function SymptomChecker() {
  const [messages, setMessages] = useState([
    {
      role: "bot", text:
        "Hello! I'm your symptom checker assistant.\n\nDescribe what you're experiencing — include your symptoms, how long you've had them, and their severity (mild / moderate / severe) — and I'll help assess the situation.",
      time: formatTime(), level: null,
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const historyRef = useRef([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", text, time: formatTime(), level: null };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    historyRef.current.push({ role: "user", content: text });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: historyRef.current,
        }),
      });

      const data = await res.json();
      const raw = data?.content?.[0]?.text || "Sorry, I couldn't process that. Please try again.";
      const level = detectLevel(raw);
      const clean = cleanText(raw);

      historyRef.current.push({ role: "assistant", content: raw });
      setMessages(prev => [...prev, { role: "bot", text: clean, time: formatTime(), level }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "bot", text: "Something went wrong. Please try again.",
        time: formatTime(), level: null,
      }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const quickSymptoms = ["Headache & fever", "Chest pain", "Sore throat", "Stomach pain"];

  return (
    <div style={{ fontFamily: "'Georgia', serif", height: "100vh", display: "flex", flexDirection: "column", background: "#F8F6F1" }}>
      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        textarea { font-family: 'Georgia', serif; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D3D1C7; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "14px 20px", background: "#fff",
        borderBottom: "0.5px solid #D3D1C7",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", background: "#E1F5EE",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2">
            <path d="M9 12h6m-3-3v6m8-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a18", letterSpacing: "-0.01em" }}>Symptom Checker</div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 1 }}>AI-powered triage assistant</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#0F6E56" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75" }} />
          Online
        </div>
      </div>

      {/* Severity legend */}
      <div style={{
        display: "flex", gap: 6, padding: "8px 16px",
        background: "#fff", borderBottom: "0.5px solid #D3D1C7",
        overflowX: "auto",
      }}>
        {Object.entries(LEVELS).map(([key, val]) => (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 9px", borderRadius: 20,
            background: val.bg, flexShrink: 0,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: val.dot }} />
            <span style={{ fontSize: 11, color: val.text, fontFamily: "sans-serif", fontWeight: 500 }}>{val.label}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{ background: "#F1EFE8", border: "0.5px solid #D3D1C7", borderRadius: "16px 16px 16px 4px" }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick symptom chips */}
      {messages.length <= 2 && !loading && (
        <div style={{ padding: "0 16px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {quickSymptoms.map(s => (
            <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{
              padding: "5px 12px", borderRadius: 20, border: "0.5px solid #B4B2A9",
              background: "#fff", fontSize: 13, color: "#444441", cursor: "pointer",
              fontFamily: "sans-serif",
            }}>{s}</button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: "10px 14px 14px", background: "#fff",
        borderTop: "0.5px solid #D3D1C7",
        display: "flex", gap: 8, alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe your symptoms…"
          rows={1}
          style={{
            flex: 1, padding: "9px 13px", borderRadius: 20,
            border: "0.5px solid #B4B2A9", fontSize: 14,
            background: "#F8F6F1", color: "#1a1a18",
            resize: "none", maxHeight: 100, overflowY: "auto",
            lineHeight: 1.5,
          }}
          onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: loading || !input.trim() ? "#D3D1C7" : "#0F6E56",
            border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s", flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
      <div style={{
        fontSize: 11, color: "#888780", textAlign: "center",
        padding: "4px 16px 10px", background: "#fff", fontFamily: "sans-serif",
      }}>
        Not a substitute for professional medical advice · Emergencies: call 112
      </div>
    </div>
  );
}
