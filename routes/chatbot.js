// ── MediBot Chatbot Route ─────────────────────────────────────────────────
// POST /api/chatbot/message
// Accepts: { messages: [{role, content}], patientContext: {age, gender, conditions, medications} }
// Returns: { text: string, verdict: null | {type, medicine} }

const express = require('express');
const router  = express.Router();

// ── System Prompt Builder ─────────────────────────────────────────────────
function buildSystemPrompt(ctx = {}) {
  const age        = ctx.age    || 'unknown';
  const gender     = ctx.gender === 'M' ? 'Male' : ctx.gender === 'F' ? 'Female' : (ctx.gender || 'not specified');
  const conditions = ctx.conditions?.length  ? ctx.conditions.join(', ')  : 'None known';
  const meds       = ctx.medications?.length ? ctx.medications.join(', ') : 'None';

  return `You are MediBot — a friendly, caring rural healthcare assistant for RuralCare Connect, serving patients in Karnataka, India.

PATIENT PROFILE (use this to personalise your assessment):
- Age: ${age}
- Gender: ${gender}
- Known medical conditions: ${conditions}
- Current medications: ${meds}

YOUR ROLE:
You are a first-level symptom triage assistant. You help patients decide how serious their condition is and what to do next.

CONVERSATION RULES:
1. If the patient has not described symptoms yet, ask them what is bothering them.
2. Ask 2–3 short, targeted follow-up questions to gather: symptom duration, severity (1–10 scale), presence of fever, and pain location.
3. Consider the patient's age, gender, and known conditions when assessing risk. For example, chest pain in a diabetic elderly patient is higher risk.
4. Keep ALL responses SHORT — maximum 3–4 sentences. One question at a time.
5. Use simple, friendly English. No medical jargon. Speak like a helpful neighbour, not a textbook.
6. NEVER claim to diagnose a specific disease.
7. Be empathetic and reassuring.

VERDICT RULES:
Once you have gathered sufficient information (usually after 2–4 exchanges), append exactly ONE verdict tag at the very end of your response, on its own line.

Available verdict tags:
  [VERDICT:NORMAL]                         — mild symptoms, rest & home care is sufficient
  [VERDICT:MEDICINE:MedicineName Dosage]   — a safe OTC medicine would help (e.g. [VERDICT:MEDICINE:Paracetamol 500mg])
  [VERDICT:DOCTOR]                         — needs a doctor visit soon, but not an emergency
  [VERDICT:EMERGENCY]                      — serious/dangerous symptoms, call 108 immediately

IMPORTANT:
- Only include a verdict when you are confident you have enough information. Keep asking if unsure.
- Always put the verdict tag on its own line at the very end.
- Do NOT include the verdict tag in the middle of the text.
- For MEDICINE verdict, choose only common, safe over-the-counter medicines (Paracetamol, ORS, Antacid, etc.).`;
}

// ── Verdict Parser ────────────────────────────────────────────────────────
function parseVerdict(text) {
  if (/\[VERDICT:EMERGENCY\]/i.test(text))         return { type: 'emergency', medicine: null };
  if (/\[VERDICT:DOCTOR\]/i.test(text))            return { type: 'doctor',    medicine: null };
  const medMatch = text.match(/\[VERDICT:MEDICINE:([^\]]+)\]/i);
  if (medMatch)                                    return { type: 'medicine',  medicine: medMatch[1].trim() };
  if (/\[VERDICT:NORMAL\]/i.test(text))            return { type: 'normal',    medicine: null };
  return null;
}

// ── Strip verdict tags from display text ──────────────────────────────────
function cleanText(text) {
  return text.replace(/\[VERDICT:[^\]]*\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ── POST /api/chatbot/message ─────────────────────────────────────────────
router.post('/message', async (req, res) => {
  try {
    const { messages, patientContext } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'undefined' || apiKey === 'null') {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please set it in environment variables.' });
    }

    const systemPrompt = buildSystemPrompt(patientContext || {});

    // Build Gemini multi-turn contents array
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            maxOutputTokens: 800,
            temperature:     0.7,
            topP:            0.9
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.status(502).json({ error: data.error.message || 'Gemini API error' });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) return res.status(502).json({ error: 'Empty response from Gemini' });

    const verdict = parseVerdict(rawText);
    const text    = cleanText(rawText);

    res.json({ text, verdict });

  } catch (e) {
    console.error('❌ Chatbot route error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
