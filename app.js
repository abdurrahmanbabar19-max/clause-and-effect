/* =====================================================================
   Clause & Effect — front-end logic
   No dependencies. The intake form is a demo (no data leaves the page).
   To take real submissions, see README.md → "Going live".
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile menu toggle
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  if (navToggle && mobileMenu) {
    const setMenu = (open) => {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      mobileMenu.hidden = !open;
    };
    navToggle.addEventListener("click", () => {
      setMenu(navToggle.getAttribute("aria-expanded") !== "true");
    });
    // Close when a link inside is tapped
    mobileMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => setMenu(false))
    );
  }

  // Elegant scroll reveal — auto-tag key blocks (skips hero so it's instant on load)
  const revealSelectors = [
    ".section-head", ".problem-card", ".step", ".who-card",
    ".price-card", ".about-copy", ".about-art", ".faq-item",
    ".launch-inner", ".intake-form"
  ];
  document.querySelectorAll(revealSelectors.join(",")).forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
  });

  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
      );
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    }
  }

  // Smooth-close other FAQ items when one opens (accordion behaviour)
  const faqItems = document.querySelectorAll("#faqList .faq-item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => { if (other !== item) other.open = false; });
      }
    });
  });

  // Intake form (demo submit)
  const form = document.getElementById("intakeForm");
  const note = document.getElementById("intakeNote");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        flash(note, "Please complete the required fields and tick the box. 🙏", false);
        // Surface native validation hints
        form.reportValidity();
        return;
      }

      const name = form.elements["name"].value.trim().split(" ")[0] || "there";
      const service = form.elements["service"].value;
      const picked = service && service !== "Not sure yet" ? ` We'll set up your ${service.split(" — ")[0]}.` : "";

      flash(
        note,
        `Thanks, ${name}! Your request is in.${picked} We'll email you within a few hours to confirm the price and next steps. ✅`,
        true
      );
      form.reset();
    });
  }

  function flash(el, msg, ok) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? "var(--gold-deep)" : "var(--red)";
    setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 8000);
  }
});
