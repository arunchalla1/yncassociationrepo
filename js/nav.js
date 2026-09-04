// YNC Association — shared header/footer + auth-aware nav
// Expects `window.YNC_ROOT` to be set before this script runs ("" at site root, "../" one level deep).

(function () {
  const ROOT = window.YNC_ROOT || "";

  function headerHTML() {
    return `
    <div class="nav-bar">
      <a class="brand" href="${ROOT}index.html">
        <img class="logo-badge" src="${ROOT}assets/ync-logo.png" alt="Yadaiah Nagar Colony Welfare Association logo">
        <span>Yadaiah Nagar Colony<small>Welfare Association &middot; One Colony, One Family</small></span>
      </a>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
      <nav class="nav-links" id="navLinks">
        <a href="${ROOT}index.html" data-page="home">Home</a>
        <a href="${ROOT}forms.html" data-page="forms">Forms</a>
        <a href="${ROOT}notices.html" data-page="notices">Notice Board</a>
        <a href="${ROOT}team.html" data-page="team">Association Team</a>
        <div class="nav-dropdown" id="festivalDropdown">
          <a href="${ROOT}festivals/index.html" data-page="festivals">Festival Committees &#9662;</a>
          <div class="nav-dropdown-menu">
            <a href="${ROOT}festivals/ganesh.html">🐘 Ganesh Committee</a>
            <a href="${ROOT}festivals/durga.html">🙏 Durga Matha Committee</a>
            <a href="${ROOT}festivals/other.html">🎉 Other Occasions</a>
          </div>
        </div>
        <div class="nav-dropdown" id="colonyDropdown">
          <a href="${ROOT}colony-info/index.html" data-page="colony-info">Colony Info &#9662;</a>
          <div class="nav-dropdown-menu">
            <a href="${ROOT}colony-info/street-3.html">🏘️ Street 3</a>
            <a href="${ROOT}colony-info/street-4.html">🏘️ Street 4</a>
            <a href="${ROOT}colony-info/street-5.html">🏘️ Street 5</a>
          </div>
        </div>
        <div class="nav-dropdown" id="financeDropdown">
          <a href="${ROOT}finance/index.html" data-page="finance">Finances &#9662;</a>
          <div class="nav-dropdown-menu">
            <a href="${ROOT}finance/index.html">💰 Association</a>
            <a href="${ROOT}finance/ganesh.html">🐘 Ganesh Committee</a>
            <a href="${ROOT}finance/durga.html">🙏 Durga Matha Committee</a>
          </div>
        </div>
        <a href="${ROOT}complaints.html" data-page="complaints">Complaints</a>
        <span class="nav-actions" id="navAuthArea" style="margin-top:6px;">
          <a href="${ROOT}login.html" class="btn btn-outline btn-sm">Staff sign in</a>
        </span>
      </nav>
    </div>`;
  }

  function footerHTML() {
    return `
    <div class="container footer-grid">
      <div>
        <div class="flex items-center gap-12" style="margin-bottom:12px;">
          <img class="footer-brand-logo" src="${ROOT}assets/ync-logo.png" alt="YNC Association logo">
          <h4 style="margin:0;">Yadaiah Nagar Colony<br>Welfare Association</h4>
        </div>
        <p style="color:#b9d4cd; max-width:36ch;">The official community portal for YNC Colony — notices, association &amp; festival committees, and resident services, all in one place. <em>One Colony, One Family.</em></p>
        <p style="color:#b9d4cd;">✉️ <a href="mailto:yncassociationteam@gmail.com">yncassociationteam@gmail.com</a></p>
      </div>
      <div>
        <h4>Quick Links</h4>
        <ul>
          <li><a href="${ROOT}forms.html">Forms</a></li>
          <li><a href="${ROOT}notices.html">Notice Board</a></li>
          <li><a href="${ROOT}team.html">Association Team</a></li>
          <li><a href="${ROOT}complaints.html">Raise a Complaint</a></li>
          <li><a href="${ROOT}colony-info/index.html">Colony Info</a></li>
          <li><a href="${ROOT}finance/index.html">Finances</a></li>
        </ul>
      </div>
      <div>
        <h4>Festival Committees</h4>
        <ul>
          <li><a href="${ROOT}festivals/ganesh.html">Ganesh Committee</a></li>
          <li><a href="${ROOT}festivals/durga.html">Durga Matha Committee</a></li>
          <li><a href="${ROOT}festivals/other.html">Other Occasions</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">© <span id="ftYear"></span> YNC Association · YNC Colony. Built for residents, by residents.</div>`;
  }

  // ---------- Festival banner (self-expiring) ----------
  // A short-lived greeting banner for a specific festival date. It's entirely
  // date-gated: outside startDate–endDate (checked against the visitor's own
  // device clock) mountFestivalBanner() does nothing, so the site reverts to
  // normal automatically — no follow-up deploy needed to remove it. To reuse
  // this for a future festival, just edit the object below and drop in a new
  // image under assets/festivals/.
  const FESTIVAL_BANNER = {
    startDate: "2026-09-04",
    endDate: "2026-09-04",
    storageKey: "yncFestivalBannerDismissed_2026-09-04",
    image: `${ROOT}assets/festivals/janmashtami-2026.jpg`,
    title: "Happy Janmashtami!",
    message: "Wishing every YNC Colony family Sri Krishna's blessings, joy, and prosperity today. 🦚🪔",
  };

  function isFestivalBannerDay() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return today >= FESTIVAL_BANNER.startDate && today <= FESTIVAL_BANNER.endDate;
  }

  function mountFestivalBanner() {
    if (!isFestivalBannerDay()) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(FESTIVAL_BANNER.storageKey) === "1"; } catch (e) { /* ignore */ }
    if (dismissed) return;

    const bar = document.createElement("div");
    bar.className = "festival-banner";
    bar.innerHTML = `
      <div class="festival-banner-inner">
        <img class="festival-banner-img" src="${FESTIVAL_BANNER.image}" alt="">
        <div class="festival-banner-text">
          <strong>${escapeHtml(FESTIVAL_BANNER.title)}</strong>
          <span>${escapeHtml(FESTIVAL_BANNER.message)}</span>
        </div>
        <button class="festival-banner-close" aria-label="Dismiss">&times;</button>
      </div>`;
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector(".festival-banner-close").addEventListener("click", () => {
      bar.remove();
      try { sessionStorage.setItem(FESTIVAL_BANNER.storageKey, "1"); } catch (e) { /* ignore */ }
    });
  }

  function mountLayout() {
    const headerEl = document.getElementById("site-header");
    const footerEl = document.getElementById("site-footer");
    if (headerEl) headerEl.innerHTML = headerHTML();
    if (footerEl) footerEl.innerHTML = footerHTML();

    const yearEl = document.getElementById("ftYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // active link highlight
    const page = document.body.getAttribute("data-page");
    if (page) {
      document.querySelectorAll(`[data-page="${page}"]`).forEach((a) => a.classList.add("active"));
    }

    // mobile toggle
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (toggle && links) {
      toggle.addEventListener("click", () => links.classList.toggle("open"));
    }
    document.querySelectorAll(".nav-dropdown").forEach((dd) => {
      const ddLink = dd.querySelector("a");
      ddLink.addEventListener("click", (e) => {
        if (window.innerWidth <= 1080) { // keep in sync with the nav breakpoint in css/style.css
          e.preventDefault();
          dd.classList.toggle("open");
        }
      });
    });
  }

  async function refreshAuthArea() {
    const area = document.getElementById("navAuthArea");
    if (!area) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      area.innerHTML = `<a href="${ROOT}login.html" class="btn btn-outline btn-sm">Sign in</a>`;
      return;
    }
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, role")
      .eq("id", session.user.id)
      .maybeSingle();

    const name = (profile && profile.full_name) || session.user.email;
    const isStaff = profile && profile.role === "admin";
    area.innerHTML = `
      ${isStaff ? `<a href="${ROOT}admin/dashboard.html" class="btn btn-primary btn-sm">Dashboard</a>` : ""}
      <span class="text-muted" style="font-size:0.85rem; margin:0 4px;">Hi, ${escapeHtml(name)}</span>
      <button class="btn btn-ghost btn-sm" id="navSignOut">Sign out</button>
    `;
    const signOutBtn = document.getElementById("navSignOut");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = ROOT + "index.html";
      });
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  window.yncEscapeHtml = escapeHtml;
  window.yncFormatDate = function (iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  window.yncFormatDateTime = function (iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  document.addEventListener("DOMContentLoaded", () => {
    mountFestivalBanner();
    mountLayout();
    refreshAuthArea();
    supabaseClient.auth.onAuthStateChange(() => refreshAuthArea());
  });
})();
