// Shared logic for the public Forms page (Volunteer Nomination + Anna Prasadam Booking + Check Status).

async function initFormsPage() {
  const committees = await loadCommittees();
  fillCommitteeSelect("nomCommitteeSelect", committees);
  fillCommitteeSelect("prasadamCommitteeSelect", committees);

  wireNominationForm(() => document.getElementById("nomCommitteeSelect").value || null);
  wirePrasadamForm(() => document.getElementById("prasadamCommitteeSelect").value || null);

  wireFormsTopTabs();
  wireStatusLookup();
}

async function loadCommittees() {
  // Only committees with an active Nomination/Prasadam workflow belong in these pickers.
  // "Other Occasions" has photo galleries but no forms behind it, so it's excluded here.
  const { data, error } = await supabaseClient.from("festival_committees").select("id,name,slug")
    .in("slug", ["ganesh", "durga"])
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data;
}

function fillCommitteeSelect(id, committees) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">Select committee…</option>` +
    committees.map(c => `<option value="${c.id}">${window.yncEscapeHtml(c.name)}</option>`).join("");
}

function wireFormsTopTabs() {
  const tabs = document.querySelectorAll("#formsTopTabs .pill-tab");
  const panels = {
    nominate: document.getElementById("formsNomPanel"),
    prasadam: document.getElementById("formsPrasadamPanel"),
    status: document.getElementById("formsStatusPanel"),
  };
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      Object.entries(panels).forEach(([key, el]) => {
        if (el) el.style.display = key === btn.dataset.t ? "block" : "none";
      });
    });
  });
}

function wireStatusLookup() {
  const form = document.getElementById("statusForm");
  if (!form) return;
  const alertBox = document.getElementById("statusAlert");
  const results = document.getElementById("statusResults");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    const raw = document.getElementById("statusQuery").value.trim();
    if (!raw) {
      alertBox.textContent = "Enter the phone number or email you used when submitting.";
      alertBox.hidden = false;
      results.innerHTML = "";
      return;
    }
    results.innerHTML = `<div class="card skeleton" style="height:80px;"></div>`;

    const isEmail = raw.includes("@");
    const phone = isEmail ? null : raw;
    const email = isEmail ? raw : null;

    const [nomRes, prasRes] = await Promise.all([
      supabaseClient.rpc("get_nomination_status", { p_phone: phone, p_email: email }),
      supabaseClient.rpc("get_prasadam_status", { p_phone: phone, p_email: email }),
    ]);

    if (nomRes.error || prasRes.error) {
      alertBox.textContent = (nomRes.error || prasRes.error).message || "Could not look up status.";
      alertBox.hidden = false;
      results.innerHTML = "";
      return;
    }

    const items = [
      ...(nomRes.data || []).map(n => ({
        kind: "🙋 Volunteer Nomination",
        committee: n.committee_name,
        title: n.nominee_name,
        sub: `${n.year} · ${n.nomination_type === "self" ? "Self-nomination" : "Nominated by someone else"}`,
        status: n.status,
        reason: n.rejection_reason,
        date: n.created_at,
      })),
      ...(prasRes.data || []).map(p => ({
        kind: "🍚 Anna Prasadam Booking",
        committee: p.committee_name,
        title: p.full_name,
        sub: `Requested slot: ${window.yncFormatDate(p.slot_date)}`,
        status: p.status,
        reason: p.rejection_reason,
        date: p.created_at,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (items.length === 0) {
      results.innerHTML = `<div class="empty-state"><div class="icon">🔍</div>No submissions found for that phone number / email.</div>`;
      return;
    }

    results.innerHTML = items.map(it => `
      <div class="card" style="margin-bottom:12px;">
        <div class="flex justify-between items-center gap-8" style="flex-wrap:wrap;">
          <span class="badge badge-cat">${window.yncEscapeHtml(it.kind)}</span>
          <span class="badge badge-${window.yncEscapeHtml(it.status)}">${window.yncEscapeHtml(it.status)}</span>
        </div>
        <h3 style="margin:10px 0 2px;">${window.yncEscapeHtml(it.title)}</h3>
        <p class="text-muted" style="font-size:0.88rem;">${window.yncEscapeHtml(it.committee || "")} · ${window.yncEscapeHtml(it.sub || "")}</p>
        ${it.status === "rejected" && it.reason ? `<p style="font-size:0.88rem; background:var(--bg); padding:8px 10px; border-radius:8px;"><strong>Why:</strong> ${window.yncEscapeHtml(it.reason)}</p>` : ""}
      </div>
    `).join("");
  });
}
