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

// Treat the placeholder key from .env.example as "no key set"
function keyConfigured() {
  const k = process.env.ANTHROPIC_API_KEY;
  return Boolean(k) && !k.includes("xxxx");
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
