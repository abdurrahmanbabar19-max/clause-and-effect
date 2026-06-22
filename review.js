/* =====================================================================
   Clause & Effect — AI reviewer front-end
   Sends the contract to /api/review and renders the report.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reviewForm");
  const note = document.getElementById("reviewNote");
  const loading = document.getElementById("loading");
  const result = document.getElementById("result");
  const runBtn = document.getElementById("runBtn");
  const sampleBtn = document.getElementById("sampleBtn");
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const SAMPLE = `INFLUENCER COLLABORATION AGREEMENT

1. Services. The Creator agrees to produce three (3) Instagram posts and two (2) TikTok videos featuring the Brand's products.

2. Fee. The Brand shall pay the Creator £400, payable within ninety (90) days of the final deliverable.

3. Exclusivity. For a period of twelve (12) months following this agreement, the Creator shall not create content for, or promote, any competing brand in the same product category.

4. Usage Rights. The Brand shall have a perpetual, worldwide, irrevocable licence to use, edit and repurpose the Creator's content across all media, including paid advertising, without further compensation.

5. Revisions. The Creator shall provide unlimited revisions until the Brand is satisfied.

6. Termination. The Brand may terminate this agreement at any time for any reason. The Creator may not terminate.`;

  sampleBtn.addEventListener("click", () => {
    form.elements["contractText"].value = SAMPLE;
    form.elements["type"].value = "Brand / influencer deal";
    form.elements["concerns"].value = "The exclusivity period and who owns my content.";
    note.textContent = "Sample loaded — hit Run AI review.";
    note.style.color = "var(--gold-deep)";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const contractText = form.elements["contractText"].value.trim();
    if (contractText.length < 50) {
      flash("Please paste the full contract text first.", false);
      return;
    }

    // UI: working state
    note.textContent = "";
    result.hidden = true;
    result.innerHTML = "";
    loading.hidden = false;
    runBtn.disabled = true;
    runBtn.textContent = "Reviewing…";

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractText,
          contractType: form.elements["type"].value,
          concerns: form.elements["concerns"].value,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed.");

      renderReport(data);
    } catch (err) {
      flash(err.message || "Something went wrong. Please try again.", false);
    } finally {
      loading.hidden = true;
      runBtn.disabled = false;
      runBtn.textContent = "Run AI review";
    }
  });

  function renderReport(r) {
    const levelLabel = { red: "⚑ Red flag", amber: "⚠ Watch", green: "✓ Fine" };
    const verdictClass = `verdict-${r.verdictLevel || "amber"}`;

    const clauses = (r.clauses || [])
      .map(
        (c) => `
        <div class="clause flag-${c.level}">
          <div class="clause-head">
            <span class="clause-title">${escapeHtml(c.title)}</span>
            <span class="clause-tag tag-${c.level}">${levelLabel[c.level] || ""}</span>
          </div>
          <p class="clause-plain">${escapeHtml(c.plain)}</p>
          <p class="clause-advice"><strong>What to do:</strong> ${escapeHtml(c.advice)}</p>
        </div>`
      )
      .join("");

    const asks = (r.asks || [])
      .map((a) => `<li>${escapeHtml(a)}</li>`)
      .join("");

    result.innerHTML = `
      <div class="report-banner ${verdictClass}">
        <span class="report-verdict-label">Verdict</span>
        <strong>${escapeHtml(r.verdict || "")}</strong>
      </div>
      <h3 class="report-h">Summary</h3>
      <p class="report-summary">${escapeHtml(r.summary || "")}</p>
      <h3 class="report-h">Clause by clause</h3>
      <div class="clause-list">${clauses || "<p class='muted'>No specific clauses flagged.</p>"}</div>
      ${asks ? `<h3 class="report-h">What to ask for before signing</h3><ul class="asks-list">${asks}</ul>` : ""}
      <p class="report-disclaimer">${escapeHtml(r.disclaimer || "")}</p>
      <div class="report-cta">
        <p>Want a human to double-check this or help you negotiate?</p>
        <a href="index.html#start" class="btn btn-primary">Book a Deep Read →</a>
      </div>
    `;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function flash(msg, ok) {
    note.textContent = msg;
    note.style.color = ok ? "var(--gold-deep)" : "var(--red)";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
