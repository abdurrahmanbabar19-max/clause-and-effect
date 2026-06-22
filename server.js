/* =====================================================================
   Clause & Effect — AI review server
   ---------------------------------------------------------------------
   A tiny Express server that:
     1. Serves the static site (index.html, review.html, etc.)
     2. Exposes POST /api/review — the AI agent that reads a contract
        and returns a plain-English report.

   The Anthropic API key lives ONLY here on the server, never in the
   browser. Set it in a .env file (see .env.example) before running.

   Run:  npm install  &&  npm start   → http://localhost:3000
   ===================================================================== */

const path = require("path");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname)); // serve index.html, review.html, styles.css, …

// Anthropic client — reads ANTHROPIC_API_KEY from the environment (.env)
const client = new Anthropic();

// Treat the placeholder key (from .env.example or the deploy step) as "no key set"
function keyConfigured() {
  const k = process.env.ANTHROPIC_API_KEY;
  return Boolean(k) && !k.includes("xxxx") && !k.includes("placeholder");
}

// ---- The shape we force the AI to return, every time ----------------
const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "2-4 sentence plain-English summary of what this contract is and the headline takeaway.",
    },
    verdict: {
      type: "string",
      description: "A short verdict line, e.g. 'Negotiable — don't sign as-is' or 'Looks fair'.",
    },
    verdictLevel: {
      type: "string",
      enum: ["green", "amber", "red"],
      description: "green = generally safe, amber = sign with caution, red = do not sign as-is.",
    },
    clauses: {
      type: "array",
      description: "The notable clauses, each explained in plain English.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short label, e.g. 'Exclusivity' or 'Payment terms'." },
          level: { type: "string", enum: ["red", "amber", "green"] },
          plain: { type: "string", description: "What this clause actually means, in everyday language." },
          advice: { type: "string", description: "What it means for the user / what to do about it." },
        },
        required: ["title", "level", "plain", "advice"],
        additionalProperties: false,
      },
    },
    asks: {
      type: "array",
      description: "Concrete things the user could ask to change before signing.",
      items: { type: "string" },
    },
    disclaimer: {
      type: "string",
      description: "A one-line reminder that this is a plain-English explanation, not regulated legal advice.",
    },
  },
  required: ["summary", "verdict", "verdictLevel", "clauses", "asks", "disclaimer"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the contract-review agent for "Clause & Effect", a London service that explains contracts in plain English for freelancers, content creators, renters and small founders.

Your job: read the contract the user sends and produce a clear, jargon-free breakdown.

Rules:
- Write for a smart non-lawyer. No legalese. Short sentences.
- Flag each notable clause as red (could seriously cost or trap them), amber (worth watching / negotiating) or green (fine / in their favour).
- Be specific and practical: say what a clause means for THEM and what to push back on.
- For the negotiation "asks", give concrete, ready-to-use requests (e.g. "Ask to cap exclusivity at 30 days").
- This is a plain-English explainer and education service, NOT regulated legal advice. If something is high-stakes, unusual, or genuinely risky, say so plainly and recommend they speak to a qualified solicitor.
- If the text doesn't look like a contract, say so in the summary and keep the other fields short.
- Never invent clauses that aren't in the text.`;

// ---- The AI review endpoint -----------------------------------------
app.post("/api/review", async (req, res) => {
  const { contractText, contractType, concerns } = req.body || {};

  if (!contractText || contractText.trim().length < 50) {
    return res
      .status(400)
      .json({ error: "Please paste the full contract text (at least a few lines)." });
  }

  if (!keyConfigured()) {
    return res.status(503).json({
      error:
        "No real ANTHROPIC_API_KEY set yet. Open the .env file, replace the placeholder with your key from console.anthropic.com, then restart the server.",
    });
  }

  const userContent =
    `Contract type: ${contractType || "Not specified"}\n` +
    `What the client is worried about: ${concerns || "Nothing specific mentioned"}\n\n` +
    `--- CONTRACT TEXT ---\n${contractText}`;

  try {
    // Stream to avoid HTTP timeouts on longer contracts; collect the final message.
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: REPORT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      return res.status(422).json({
        error:
          "The reviewer couldn't process this document. If it's a sensitive matter, please speak to a qualified solicitor.",
      });
    }

    const textBlock = final.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No report returned by the model.");

    const report = JSON.parse(textBlock.text);
    res.json(report);
  } catch (err) {
    console.error("Review failed:", err);
    res.status(500).json({
      error: "Something went wrong running the review. Please try again in a moment.",
    });
  }
});

// =====================================================================
//  FREE study help — POST /api/explain
//  A student sends a law module + topic (+ optional notes/question) and
//  gets it explained in a way that's genuinely easy to understand.
// =====================================================================
const EXPLAIN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short, clear title of the topic being explained." },
    inOneLine: { type: "string", description: "The whole topic boiled down to one plain sentence a tired student would understand." },
    explanation: {
      type: "string",
      description: "The main easy explanation. Plain English, warm tutor voice, short sentences. Use blank lines between paragraphs. Build from the simplest idea up.",
    },
    analogy: {
      type: "string",
      description: "A relatable everyday analogy that makes the concept click. Keep it short.",
    },
    keyPoints: {
      type: "array",
      description: "The must-know points / definitions for this topic.",
      items: { type: "string" },
    },
    cases: {
      type: "array",
      description: "Key cases or statutes for this topic (only real, well-known ones — never invent). Empty array if none apply.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Case or statute name, e.g. 'Donoghue v Stevenson [1932]'." },
          principle: { type: "string", description: "In one plain sentence, what it established and why it matters." },
        },
        required: ["name", "principle"],
        additionalProperties: false,
      },
    },
    essayPlan: {
      type: "array",
      description: "A structure/plan for answering an essay or problem question on this topic — headings + what to cover. This is a PLAN and technique, NOT a finished essay to submit.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "Section heading, e.g. 'Introduction', 'Issue 1: Duty of care'." },
          detail: { type: "string", description: "What to actually write/argue in this section, and which cases to cite." },
        },
        required: ["heading", "detail"],
        additionalProperties: false,
      },
    },
    examTips: {
      type: "array",
      description: "Practical tips: how to score marks, common mistakes students make, things examiners love.",
      items: { type: "string" },
    },
    disclaimer: {
      type: "string",
      description: "One-line reminder: a study aid to aid understanding, always check against their own syllabus/lecturer, and not a substitute for their own work.",
    },
  },
  required: ["title", "inOneLine", "explanation", "keyPoints", "essayPlan", "disclaimer"],
  additionalProperties: false,
};

const EXPLAIN_SYSTEM_PROMPT = `You are a warm, brilliant law tutor who makes university law modules genuinely easy to understand. You help LLB and law students who are confused by their chapters and notes.

Default to the law of England & Wales unless the student's notes or question clearly point to another jurisdiction — then follow that.

Your job: take the topic (and any notes the student pastes) and explain it so clearly that a stressed, confused student finally "gets it".

Rules:
- Teach like the best tutor they ever had: patient, plain English, short sentences, build from the simplest idea upwards. No showing off, no unnecessary jargon — and when you must use a legal term, define it immediately.
- If the student pastes their own notes/material, base your explanation on THAT — clarify it, fill the gaps, and untangle the confusing bits. Don't ignore what they gave you.
- Be accurate. Only cite real, well-known cases and statutes. NEVER invent a case, citation, or rule. If you're unsure a case exists, leave it out.
- Make it stick: use a clear everyday analogy where it helps.
- ACADEMIC INTEGRITY IS CRITICAL: provide an essay/answer PLAN, structure, and technique — never a finished, submittable essay. You are helping them understand and learn to write it themselves, not doing their coursework for them. If they ask you to "write my essay", give them a strong plan and model structure instead and gently explain why.
- This is a free study aid to aid understanding. Remind them to always check against their own syllabus and lecturer, and that it doesn't replace their own reading and work.`;

app.post("/api/explain", async (req, res) => {
  const { subject, topic, question, notes } = req.body || {};

  if (!topic || topic.trim().length < 2) {
    return res.status(400).json({ error: "Tell me which topic or chapter you'd like explained." });
  }

  if (!keyConfigured()) {
    return res.status(503).json({
      error:
        "The free explainer is just being switched on — the API key isn't live yet. Check back very soon!",
    });
  }

  const userContent =
    `Module / subject: ${subject || "Not specified"}\n` +
    `Topic / chapter: ${topic}\n` +
    `Their specific question: ${question || "None — just explain the topic clearly."}\n\n` +
    (notes && notes.trim()
      ? `--- THE STUDENT'S OWN NOTES / MATERIAL (base your explanation on this) ---\n${notes}`
      : `(No notes pasted — explain the topic from scratch.)`);

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: EXPLAIN_SCHEMA },
      },
      system: EXPLAIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      return res.status(422).json({
        error: "Sorry — I couldn't help with that one. Try rephrasing the topic.",
      });
    }

    const textBlock = final.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No explanation returned by the model.");

    res.json(JSON.parse(textBlock.text));
  } catch (err) {
    console.error("Explain failed:", err);
    res.status(500).json({
      error: "Something went wrong generating the explanation. Please try again in a moment.",
    });
  }
});

// Friendly health check
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, keySet: keyConfigured() })
);

app.listen(PORT, () => {
  console.log(`\n  Clause & Effect running →  http://localhost:${PORT}`);
  if (!keyConfigured()) {
    console.log("  ⚠  No ANTHROPIC_API_KEY found — AI review will be disabled until you add one to .env\n");
  } else {
    console.log("  ✓  AI review enabled (Claude Opus 4.8)\n");
  }
});
