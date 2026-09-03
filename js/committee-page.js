// Shared logic for a festival committee page (Ganesh / Durga Matha).
// Usage: initCommitteePage({ slug: "ganesh" });

async function initCommitteePage(opts) {
  const { slug } = opts;

  const { data: committee, error: cErr } = await supabaseClient
    .from("festival_committees").select("*").eq("slug", slug).maybeSingle();

  if (cErr || !committee) {
    document.getElementById("committeeYearWrap").innerHTML =
      `<div class="alert alert-error">Could not load this committee.</div>`;
    return;
  }
  window.__committee = committee;

  const { data: rows } = await supabaseClient
    .from("festival_committee_members").select("year").eq("committee_id", committee.id).order("year", { ascending: false });
  let years = [...new Set((rows || []).map(r => r.year))];
  if (years.length === 0) years = [YNC_CONFIG.currentYear];

  const sel = document.getElementById("committeeYearSelect");
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  sel.addEventListener("change", () => loadForYear(committee.id, Number(sel.value)));

  loadForYear(committee.id, Number(sel.value));
  loadGallery(committee.id);
}

function initials(name) {
  return (name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

async function loadForYear(committeeId, year) {
  const grid = document.getElementById("committeeTeamGrid");
  grid.innerHTML = `<div class="card skeleton" style="height:160px;"></div><div class="card skeleton" style="height:160px;"></div>`;

  const { data } = await supabaseClient
    .from("festival_committee_members").select("*")
    .eq("committee_id", committeeId).eq("year", year)
    .order("display_order", { ascending: true });

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🧑‍🤝‍🧑</div>No committee members recorded for ${year} yet.</div>`;
    return;
  }
  grid.innerHTML = data.map(m => `
    <div class="card card-hover text-center">
      ${m.photo_url
        ? `<img src="${yncEscapeHtml(m.photo_url)}" alt="${yncEscapeHtml(m.name)}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;margin:0 auto 10px;">`
        : `<div class="avatar-circle" style="width:70px;height:70px;font-size:1.3rem;margin:0 auto 10px;">${initials(m.name)}</div>`}
      <h3 style="margin-bottom:2px; font-size:1.05rem;">${yncEscapeHtml(m.name)}</h3>
      <p style="color:var(--accent-dark); font-weight:600; font-size:0.85rem;">${yncEscapeHtml(m.position)}</p>
    </div>
  `).join("");
}

async function loadGallery(committeeId) {
  const grid = document.getElementById("committeeGallery");
  const { data } = await supabaseClient
    .from("photos").select("*").eq("committee_id", committeeId)
    .order("year", { ascending: false }).order("created_at", { ascending: false })
    .limit(12);

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📷</div>No photos uploaded yet.</div>`;
    return;
  }
  grid.innerHTML = data.map(p => `
    <div>
      <img src="${yncEscapeHtml(p.thumbnail_url || p.image_url)}" alt="${yncEscapeHtml(p.caption || '')}" loading="lazy">
      ${p.caption ? `<div class="gallery-caption">${yncEscapeHtml(p.caption)} · ${p.year || ""}</div>` : ""}
    </div>
  `).join("");
}

function wireNominationForm(committeeIdSource) {
  const form = document.getElementById("nominationForm");
  if (!form) return;
  const alertBox = document.getElementById("nomAlert");
  const successBox = document.getElementById("nomSuccess");
  const typeRadios = form.querySelectorAll('input[name="nomType"]');
  const otherFields = document.getElementById("nominatedByFields");

  const emailInput = document.getElementById("nomineeEmail");
  const emailHint = document.getElementById("nomineeEmailHint");

  function syncType() {
    const val = form.querySelector('input[name="nomType"]:checked').value;
    otherFields.style.display = val === "other" ? "block" : "none";
    const selfSelected = val === "self";
    emailInput.required = selfSelected;
    if (emailHint) emailHint.textContent = selfSelected
      ? "Required — we'll email you here once the committee approves your nomination."
      : "Optional — used to notify the nominee if approved.";
  }
  typeRadios.forEach(r => r.addEventListener("change", syncType));
  syncType();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.hidden = true; successBox.hidden = true;
    const btn = document.getElementById("nomBtn");
    btn.disabled = true; btn.textContent = "Submitting…";

    const committeeId = typeof committeeIdSource === "function" ? committeeIdSource() : committeeIdSource;
    if (!committeeId) {
      alertBox.textContent = "Please choose which committee this is for.";
      alertBox.hidden = false;
      btn.disabled = false; btn.textContent = "Submit nomination";
      return;
    }

    const nomType = form.querySelector('input[name="nomType"]:checked').value;
    const payload = {
      committee_id: committeeId,
      year: YNC_CONFIG.currentYear,
      nomination_type: nomType,
      nominee_name: document.getElementById("nomineeName").value.trim(),
      nominee_phone: document.getElementById("nomineePhone").value.trim(),
      nominee_email: document.getElementById("nomineeEmail").value.trim(),
      house_number: document.getElementById("nomineeHouse").value.trim(),
      message: document.getElementById("nomMessage").value.trim(),
      nominated_by_name: nomType === "other" ? document.getElementById("nominatedByName").value.trim() : null,
      nominated_by_phone: nomType === "other" ? document.getElementById("nominatedByPhone").value.trim() : null,
    };

    const { error } = await supabaseClient.from("nominations").insert(payload);
    btn.disabled = false; btn.textContent = "Submit nomination";

    if (error) {
      alertBox.textContent = error.message || "Could not submit nomination.";
      alertBox.hidden = false;
      return;
    }
    successBox.textContent = "Thank you! Your nomination has been sent to the committee for review. You'll get an email once it's approved.";
    successBox.hidden = false;
    form.reset();
    syncType();
  });
}

// ========================================================= ANNA PRASADAM SLOT BOOKING
function wirePrasadamForm(committeeIdSource) {
  const form = document.getElementById("prasadamForm");
  if (!form) return;
  const alertBox = document.getElementById("prasadamAlert");
  const successBox = document.getElementById("prasadamSuccess");
  const dateInput = document.getElementById("prasadamDate");
  const today = new Date().toISOString().slice(0, 10);
  if (dateInput) dateInput.min = today;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.hidden = true; successBox.hidden = true;
    const btn = document.getElementById("prasadamBtn");
    btn.disabled = true; btn.textContent = "Submitting…";

    const committeeId = typeof committeeIdSource === "function" ? committeeIdSource() : committeeIdSource;
    if (!committeeId) {
      alertBox.textContent = "Please choose which committee this is for.";
      alertBox.hidden = false;
      btn.disabled = false; btn.textContent = "Request slot";
      return;
    }

    const payload = {
      committee_id: committeeId,
      year: YNC_CONFIG.currentYear,
      full_name: document.getElementById("prasadamName").value.trim(),
      phone: document.getElementById("prasadamPhone").value.trim(),
      email: document.getElementById("prasadamEmail").value.trim() || null,
      slot_date: document.getElementById("prasadamDate").value,
      people_count: Number(document.getElementById("prasadamCount").value) || null,
      notes: document.getElementById("prasadamNotes").value.trim() || null,
    };

    const { error } = await supabaseClient.from("prasadam_bookings").insert(payload);
    btn.disabled = false; btn.textContent = "Request slot";

    if (error) {
      alertBox.textContent = error.message || "Could not submit your request.";
      alertBox.hidden = false;
      return;
    }
    successBox.textContent = "Thank you! Your Anna Prasadam slot request has been sent to the committee — they'll confirm by email or phone.";
    successBox.hidden = false;
    form.reset();
    if (dateInput) dateInput.min = today;
  });
}
