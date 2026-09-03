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

  // nomination form defaults to the most recent year
  document.getElementById("nomYear").value = years[0];

  loadForYear(committee.id, Number(sel.value));
  loadGallery(committee.id);
  wireNominationForm(committee.id);
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

function wireNominationForm(committeeId) {
  const form = document.getElementById("nominationForm");
  const alertBox = document.getElementById("nomAlert");
  const successBox = document.getElementById("nomSuccess");
  const typeRadios = form.querySelectorAll('input[name="nomType"]');
  const otherFields = document.getElementById("nominatedByFields");

  function syncType() {
    const val = form.querySelector('input[name="nomType"]:checked').value;
    otherFields.style.display = val === "other" ? "block" : "none";
  }
  typeRadios.forEach(r => r.addEventListener("change", syncType));
  syncType();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.hidden = true; successBox.hidden = true;
    const btn = document.getElementById("nomBtn");
    btn.disabled = true; btn.textContent = "Submitting…";

    const nomType = form.querySelector('input[name="nomType"]:checked').value;
    const payload = {
      committee_id: committeeId,
      year: Number(document.getElementById("nomYear").value),
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
    successBox.textContent = "Thank you! Your nomination has been sent to the committee for review.";
    successBox.hidden = false;
    form.reset();
    syncType();
  });
}
