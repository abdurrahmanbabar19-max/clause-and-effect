/* =====================================================================
   Clause & Effect — free "Law, made simple" explainer (front-end)
   Sends a topic (+ optional notes) to /api/explain and renders it clearly.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("explainForm");
  const note = document.getElementById("explainNote");
  const loading = document.getElementById("loading");
  const result = document.getElementById("result");
  const runBtn = document.getElementById("explainBtn");
  const sampleBtn = document.getElementById("sampleBtn");
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  sampleBtn.addEventListener("click", () => {
    form.elements["subject"].value = "Tort Law";
    form.elements["topic"].value = "Duty of care (negligence)";
    form.elements["question"].value = "I don't understand how courts decide if a duty of care exists.";
    form.elements["notes"].value = "";
    flash("Example loaded — hit “Explain it simply”.", true);
    form.elements["topic"].scrollIntoView({ behavior: "smooth", block: "center" });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = form.elements["topic"].value.trim();
    if (topic.length < 2) {
      flash("Tell me which topic or chapter you'd like explained first.", false);
      return;
    }

    note.textContent = "";
    result.hidden = true;
    result.innerHTML = "";
    loading.hidden = false;
    runBtn.disabled = true;
    runBtn.textContent = "Thinking…";

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.elements["subject"].value,
          topic,
          question: form.elements["question"].value,
          notes: form.elements["notes"].value,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate an explanation.");

      renderExplanation(data);
    } catch (err) {
      flash(err.message || "Something went wrong. Please try again.", false);
    } finally {
      loading.hidden = true;
      runBtn.disabled = false;
      runBtn.textContent = "✨ Explain it simply";
    }
  });

  function renderExplanation(r) {
    const paras = String(r.explanation || "")
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((p) => `<p class="report-summary">${escapeHtml(p)}</p>`)
      .join("");

    const keyPoints = (r.keyPoints || [])
      .map((k) => `<li>${escapeHtml(k)}</li>`)
      .join("");

    const cases = (r.cases || [])
      .map(
        (c) => `
        <div class="clause flag-green">
          <div class="clause-head"><span class="clause-title">${escapeHtml(c.name)}</span></div>
          <p class="clause-plain">${escapeHtml(c.principle)}</p>
        </div>`
      )
      .join("");

    const essayPlan = (r.essayPlan || [])
      .map(
        (s) => `
        <div class="clause flag-amber">
          <div class="clause-head"><span class="clause-title">${escapeHtml(s.heading)}</span></div>
          <p class="clause-plain">${escapeHtml(s.detail)}</p>
        </div>`
      )
      .join("");

    const examTips = (r.examTips || [])
      .map((t) => `<li>${escapeHtml(t)}</li>`)
      .join("");

    result.innerHTML = `
      <div class="report-banner verdict-green">
        <span class="report-verdict-label">Topic</span>
        <strong>${escapeHtml(r.title || "")}</strong>
      </div>
      ${r.inOneLine ? `<p class="explain-oneline">${escapeHtml(r.inOneLine)}</p>` : ""}

      <h3 class="report-h">In plain English</h3>
      ${paras || "<p class='muted'>No explanation returned.</p>"}

      ${r.analogy ? `<div class="explain-analogy"><span>💡 Think of it like…</span><p>${escapeHtml(r.analogy)}</p></div>` : ""}

      ${keyPoints ? `<h3 class="report-h">Key points to know</h3><ul class="asks-list">${keyPoints}</ul>` : ""}

      ${cases ? `<h3 class="report-h">Key cases &amp; principles</h3><div class="clause-list">${cases}</div>` : ""}

      ${essayPlan ? `<h3 class="report-h">How to plan an essay answer</h3><div class="clause-list">${essayPlan}</div>` : ""}

      ${examTips ? `<h3 class="report-h">Exam tips</h3><ul class="asks-list">${examTips}</ul>` : ""}

      <p class="report-disclaimer">${escapeHtml(r.disclaimer || "")}</p>

      <div class="report-cta">
        <p>Was this helpful? Share it with a coursemate who's stuck — that's all I ask. 🙏</p>
        <a href="learn.html" class="btn btn-primary">Explain another topic</a>
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
