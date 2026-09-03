// YNC Association — Staff dashboard logic
// All writes rely on Supabase RLS: only profiles.role in ('association','admin') can succeed.

let ME = null;      // auth user
let MY_ROLE = null; // profile row
let ACTIVE_TAB = "overview";
const COMMITTEES = { ganesh: null, durga: null, other: null }; // filled with committee rows

// ---------- Modal helpers ----------
function openModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalBackdrop").classList.add("open");
}
function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
  document.getElementById("modalBody").innerHTML = "";
}
document.addEventListener("click", (e) => {
  if (e.target.id === "modalBackdrop") closeModal();
});

function esc(s) { return window.yncEscapeHtml(s == null ? "" : s); }

// ---------- Boot ----------
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return showGate();

  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (!profile || (profile.role !== "association" && profile.role !== "admin")) return showGate(true);

  ME = session.user;
  MY_ROLE = profile;
  document.getElementById("gate").style.display = "none";
  document.getElementById("dash").style.display = "block";
  document.getElementById("whoAmI").textContent = `Signed in as ${profile.full_name || ME.email} · role: ${profile.role}`;

  const { data: committees } = await supabaseClient.from("festival_committees").select("*");
  (committees || []).forEach(c => { COMMITTEES[c.slug] = c; });

  wireTabs();
  renderTab("overview");
}

function showGate(wrongRole) {
  document.getElementById("gate").innerHTML = wrongRole
    ? `<div class="card gate-card"><div class="icon">🚫</div><h3>Staff access only</h3><p class="text-muted">Your account doesn't have Association or Festival Committee staff access. Contact the association if you believe this is a mistake.</p><a href="../index.html" class="btn btn-outline">Back to site</a></div>`
    : `<div class="card gate-card"><div class="icon">🔒</div><h3>Staff sign-in required</h3><p class="text-muted">This dashboard is for Association &amp; Festival Committee staff.</p><a href="../login.html" class="btn btn-primary">Sign in</a></div>`;
}

function wireTabs() {
  document.querySelectorAll("#tabBar .pill-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tabBar .pill-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });
}

function renderTab(tab) {
  ACTIVE_TAB = tab;
  const map = {
    overview: renderOverview, notices: renderNotices, complaints: renderComplaints,
    nominations: renderNominations, team: renderTeam, "festival-team": renderFestivalTeam,
    photos: renderPhotos, residents: renderResidents, finances: renderFinances,
  };
  (map[tab] || renderOverview)();
}

// ========================================================= OVERVIEW
async function renderOverview() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `<div class="grid grid-4" id="ovStats">
    <div class="card skeleton" style="height:90px;"></div><div class="card skeleton" style="height:90px;"></div>
    <div class="card skeleton" style="height:90px;"></div><div class="card skeleton" style="height:90px;"></div>
  </div>`;

  const [{ count: openC }, { count: pendingNom }, { count: residents }, { count: notices }] = await Promise.all([
    supabaseClient.from("complaints").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabaseClient.from("nominations").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabaseClient.from("residents").select("*", { count: "exact", head: true }),
    supabaseClient.from("notices").select("*", { count: "exact", head: true }),
  ]);

  document.getElementById("ovStats").innerHTML = `
    <div class="card stat-card"><div class="num">${openC ?? 0}</div><div class="label">Open Complaints</div></div>
    <div class="card stat-card"><div class="num">${pendingNom ?? 0}</div><div class="label">Pending Nominations</div></div>
    <div class="card stat-card"><div class="num">${residents ?? 0}</div><div class="label">Residents Listed</div></div>
    <div class="card stat-card"><div class="num">${notices ?? 0}</div><div class="label">Total Notices</div></div>
  `;
}

// ========================================================= NOTICES
async function renderNotices() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center" style="margin-bottom:14px;">
      <h2 style="margin:0;">Notices &amp; Announcements</h2>
      <button class="btn btn-primary btn-sm" id="btnNewNotice">+ New notice</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Type</th><th>Category</th><th>Pinned</th><th>Published</th><th></th></tr></thead>
      <tbody id="noticesBody"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>
    </table></div>`;

  document.getElementById("btnNewNotice").addEventListener("click", () => openNoticeForm());

  const { data } = await supabaseClient.from("notices").select("*").order("published_at", { ascending: false });
  const body = document.getElementById("noticesBody");
  if (!data || data.length === 0) { body.innerHTML = `<tr><td colspan="6" class="text-muted">No notices yet.</td></tr>`; return; }
  body.innerHTML = data.map(n => `
    <tr>
      <td><strong>${esc(n.title)}</strong><div class="text-muted" style="font-size:0.8rem;">${esc(n.body).slice(0,70)}${n.body.length>70?"…":""}</div></td>
      <td>${esc(n.type)}</td>
      <td><span class="badge badge-cat">${esc(n.category)}</span></td>
      <td>${n.is_pinned ? "📌 Yes" : "—"}</td>
      <td>${window.yncFormatDate(n.published_at)}</td>
      <td class="flex gap-8">
        <button class="btn btn-ghost btn-sm" data-edit="${n.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${n.id}">Delete</button>
      </td>
    </tr>`).join("");

  body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openNoticeForm(data.find(n => n.id === b.dataset.edit))));
  body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this notice?")) return;
    await supabaseClient.from("notices").delete().eq("id", b.dataset.del);
    renderNotices();
  }));
}

function openNoticeForm(existing) {
  openModal(`
    <h3>${existing ? "Edit" : "New"} notice</h3>
    <div id="noticeFormAlert" class="alert alert-error" hidden></div>
    <form id="noticeForm">
      <div class="field"><label>Type</label>
        <select id="nType">
          <option value="notice" ${existing?.type==="notice"?"selected":""}>Notice</option>
          <option value="announcement" ${existing?.type==="announcement"?"selected":""}>Announcement</option>
        </select>
      </div>
      <div class="field"><label>Title</label><input type="text" id="nTitle" value="${esc(existing?.title)}" required></div>
      <div class="field"><label>Body</label><textarea id="nBody" required>${esc(existing?.body)}</textarea></div>
      <div class="grid grid-2">
        <div class="field"><label>Category</label><input type="text" id="nCategory" value="${esc(existing?.category || "General")}"></div>
        <div class="field"><label>Attachment URL (optional)</label><input type="url" id="nAttachment" value="${esc(existing?.attachment_url)}"></div>
      </div>
      <div class="check-group field"><label><input type="checkbox" id="nPinned" ${existing?.is_pinned?"checked":""}> Pin to top</label></div>
      <div class="flex gap-8" style="margin-top:10px;">
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Publish"}</button>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("noticeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      type: document.getElementById("nType").value,
      title: document.getElementById("nTitle").value.trim(),
      body: document.getElementById("nBody").value.trim(),
      category: document.getElementById("nCategory").value.trim() || "General",
      attachment_url: document.getElementById("nAttachment").value.trim() || null,
      is_pinned: document.getElementById("nPinned").checked,
    };
    if (!existing) { payload.posted_by = ME.id; payload.published_at = new Date().toISOString(); }
    const q = existing
      ? supabaseClient.from("notices").update(payload).eq("id", existing.id)
      : supabaseClient.from("notices").insert(payload);
    const { error } = await q;
    if (error) {
      const a = document.getElementById("noticeFormAlert"); a.textContent = error.message; a.hidden = false; return;
    }
    closeModal(); renderNotices();
  });
}

// ========================================================= COMPLAINTS
let complaintStatusFilter = "all";
async function renderComplaints() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <h2>Complaints</h2>
    <div class="pill-tabs" id="complaintFilterTabs">
      <button class="pill-tab active" data-f="all">All</button>
      <button class="pill-tab" data-f="open">Open</button>
      <button class="pill-tab" data-f="in_progress">In progress</button>
      <button class="pill-tab" data-f="resolved">Resolved</button>
      <button class="pill-tab" data-f="closed">Closed</button>
    </div>
    <div id="complaintsList"></div>`;

  document.querySelectorAll("#complaintFilterTabs .pill-tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#complaintFilterTabs .pill-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); complaintStatusFilter = b.dataset.f; loadComplaintsList();
  }));
  loadComplaintsList();
}

async function loadComplaintsList() {
  const list = document.getElementById("complaintsList");
  list.innerHTML = `<div class="card skeleton" style="height:100px;"></div>`;
  let q = supabaseClient.from("complaints").select("*, complaint_responses(*)").order("created_at", { ascending: false });
  if (complaintStatusFilter !== "all") q = q.eq("status", complaintStatusFilter);
  const { data } = await q;

  if (!data || data.length === 0) { list.innerHTML = `<div class="empty-state"><div class="icon">✅</div>No complaints here.</div>`; return; }

  list.innerHTML = data.map(c => `
    <div class="card" style="margin-bottom:14px;">
      <div class="flex justify-between items-center gap-8" style="flex-wrap:wrap;">
        <div class="flex items-center gap-8" style="flex-wrap:wrap;">
          <span class="badge badge-${c.status}">${c.status.replace("_"," ")}</span>
          <span class="badge badge-cat">${esc(c.category)}</span>
          <span class="badge badge-priority-${c.priority}">${c.priority} priority</span>
        </div>
        <span class="text-muted" style="font-size:0.8rem;">${window.yncFormatDateTime(c.created_at)}</span>
      </div>
      <h3 style="margin:10px 0 2px;">${esc(c.subject)}</h3>
      <p class="text-muted" style="font-size:0.9rem;">${esc(c.description)}</p>
      ${c.photo_url ? `<img src="${esc(c.photo_url)}" style="max-width:180px;border-radius:8px;margin-bottom:8px;">` : ""}
      <p style="font-size:0.85rem;"><strong>${esc(c.raised_by_name)}</strong> ${c.raised_by_house ? "· House " + esc(c.raised_by_house) : ""} ${c.raised_by_phone ? "· " + esc(c.raised_by_phone) : ""}</p>

      ${(c.complaint_responses||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(r => `
        <div style="background:var(--bg); border-radius:8px; padding:10px 12px; margin-top:8px; font-size:0.88rem;">
          <strong>${esc(r.responder_name)}:</strong> ${esc(r.message)}
          <div class="text-muted" style="font-size:0.74rem;">${window.yncFormatDateTime(r.created_at)}</div>
        </div>`).join("")}

      <form class="respond-form" data-id="${c.id}" style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
        <div class="grid grid-2">
          <div class="field" style="margin-bottom:8px;">
            <label style="font-size:0.8rem;">Update status</label>
            <select class="statusSelect">
              <option value="open" ${c.status==="open"?"selected":""}>Open</option>
              <option value="in_progress" ${c.status==="in_progress"?"selected":""}>In progress</option>
              <option value="resolved" ${c.status==="resolved"?"selected":""}>Resolved</option>
              <option value="closed" ${c.status==="closed"?"selected":""}>Closed</option>
            </select>
          </div>
          <div class="field" style="margin-bottom:8px;">
            <label style="font-size:0.8rem;">Priority</label>
            <select class="prioritySelect">
              <option value="low" ${c.priority==="low"?"selected":""}>Low</option>
              <option value="medium" ${c.priority==="medium"?"selected":""}>Medium</option>
              <option value="high" ${c.priority==="high"?"selected":""}>High</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-bottom:8px;"><textarea placeholder="Write a response to the resident…" class="responseMsg" style="min-height:60px;"></textarea></div>
        <button type="submit" class="btn btn-primary btn-sm">Send response &amp; update</button>
      </form>
    </div>
  `).join("");

  document.querySelectorAll(".respond-form").forEach(f => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = f.dataset.id;
    const status = f.querySelector(".statusSelect").value;
    const priority = f.querySelector(".prioritySelect").value;
    const message = f.querySelector(".responseMsg").value.trim();

    await supabaseClient.from("complaints").update({ status, priority, assigned_to: ME.id }).eq("id", id);
    if (message) {
      await supabaseClient.from("complaint_responses").insert({
        complaint_id: id, responder_id: ME.id, responder_name: MY_ROLE.full_name || ME.email,
        message, is_status_change: true, new_status: status,
      });
    }
    loadComplaintsList();
  }));
}

// ========================================================= NOMINATIONS
async function renderNominations() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `<h2>Volunteer Nominations</h2><div id="nomList"></div>`;
  const { data } = await supabaseClient.from("nominations").select("*, festival_committees(name)").order("created_at", { ascending: false });
  const list = document.getElementById("nomList");
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty-state"><div class="icon">🙌</div>No nominations yet.</div>`; return; }

  list.innerHTML = data.map(n => `
    <div class="card" style="margin-bottom:12px;">
      <div class="flex justify-between items-center gap-8" style="flex-wrap:wrap;">
        <div class="flex items-center gap-8" style="flex-wrap:wrap;">
          <span class="badge badge-${n.status}">${n.status}</span>
          <span class="badge badge-cat">${esc(n.festival_committees?.name)} · ${n.year}</span>
        </div>
        <span class="text-muted" style="font-size:0.8rem;">${window.yncFormatDateTime(n.created_at)}</span>
      </div>
      <h3 style="margin:10px 0 2px;">${esc(n.nominee_name)} ${n.house_number ? `<span class="text-muted" style="font-weight:400;">· House ${esc(n.house_number)}</span>` : ""}</h3>
      <p class="text-muted" style="font-size:0.88rem;">${n.nominee_phone ? "📞 "+esc(n.nominee_phone)+" " : ""}${n.nominee_email ? "✉️ "+esc(n.nominee_email) : ""}</p>
      ${n.nomination_type === "other" ? `<p style="font-size:0.85rem;">Nominated by: <strong>${esc(n.nominated_by_name)}</strong> ${n.nominated_by_phone ? "("+esc(n.nominated_by_phone)+")" : ""}</p>` : `<p style="font-size:0.85rem;">Self-nomination</p>`}
      ${n.message ? `<p style="font-size:0.88rem; background:var(--bg); padding:8px 10px; border-radius:8px;">${esc(n.message)}</p>` : ""}
      ${n.status === "pending" ? `
        <div class="flex gap-8" style="margin-top:8px;">
          <button class="btn btn-primary btn-sm" data-approve="${n.id}">Approve</button>
          <button class="btn btn-danger btn-sm" data-reject="${n.id}">Reject</button>
        </div>` : ""}
    </div>
  `).join("");

  list.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", async () => {
    await supabaseClient.from("nominations").update({ status: "approved" }).eq("id", b.dataset.approve);
    renderNominations();
  }));
  list.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", async () => {
    await supabaseClient.from("nominations").update({ status: "rejected" }).eq("id", b.dataset.reject);
    renderNominations();
  }));
}

// ========================================================= ASSOCIATION TEAM
async function renderTeam() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Association Team</h2>
      <div class="flex items-center gap-8">
        <label style="margin:0;">Year:</label>
        <select id="teamYearSelect" style="width:auto;"></select>
        <button class="btn btn-primary btn-sm" id="btnAddTeamMember">+ Add member</button>
      </div>
    </div>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>#</th><th>Position</th><th>Name</th><th>Contact</th><th></th></tr></thead>
      <tbody id="teamBody"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>
    </table></div>`;

  const currentYear = YNC_CONFIG.currentYear;
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const sel = document.getElementById("teamYearSelect");
  sel.innerHTML = years.map(y => `<option value="${y}" ${y===currentYear?"selected":""}>${y}</option>`).join("");
  sel.addEventListener("change", () => loadTeamRows(Number(sel.value)));
  document.getElementById("btnAddTeamMember").addEventListener("click", () => openTeamForm(null, Number(sel.value)));
  loadTeamRows(currentYear);
}

async function loadTeamRows(year) {
  const { data } = await supabaseClient.from("association_team").select("*").eq("year", year).order("display_order");
  const body = document.getElementById("teamBody");
  if (!data || data.length === 0) { body.innerHTML = `<tr><td colspan="5" class="text-muted">No members for ${year} yet.</td></tr>`; return; }
  body.innerHTML = data.map((m,i) => `
    <tr>
      <td>${i+1}</td><td>${esc(m.position)}</td><td>${esc(m.name)}</td>
      <td>${esc(m.phone)}${m.email ? " · "+esc(m.email) : ""}</td>
      <td class="flex gap-8">
        <button class="btn btn-ghost btn-sm" data-edit="${m.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${m.id}">Delete</button>
      </td>
    </tr>`).join("");
  body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openTeamForm(data.find(m=>m.id===b.dataset.edit), year)));
  body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this member?")) return;
    await supabaseClient.from("association_team").delete().eq("id", b.dataset.del);
    loadTeamRows(year);
  }));
}

function openTeamForm(existing, year) {
  openModal(`
    <h3>${existing ? "Edit" : "Add"} team member — ${year}</h3>
    <div id="teamFormAlert" class="alert alert-error" hidden></div>
    <form id="teamForm">
      <div class="grid grid-2">
        <div class="field"><label>Position</label><input type="text" id="tPosition" value="${esc(existing?.position)}" required></div>
        <div class="field"><label>Name</label><input type="text" id="tName" value="${esc(existing?.name)}" required></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Phone</label><input type="tel" id="tPhone" value="${esc(existing?.phone)}"></div>
        <div class="field"><label>Email</label><input type="email" id="tEmail" value="${esc(existing?.email)}"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Photo URL (optional)</label><input type="url" id="tPhoto" value="${esc(existing?.photo_url)}"></div>
        <div class="field"><label>Display order</label><input type="number" id="tOrder" value="${existing?.display_order ?? 0}"></div>
      </div>
      <div class="flex gap-8"><button class="btn btn-primary" type="submit">Save</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>
    </form>
  `);
  document.getElementById("teamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      year, position: document.getElementById("tPosition").value.trim(), name: document.getElementById("tName").value.trim(),
      phone: document.getElementById("tPhone").value.trim() || null, email: document.getElementById("tEmail").value.trim() || null,
      photo_url: document.getElementById("tPhoto").value.trim() || null, display_order: Number(document.getElementById("tOrder").value) || 0,
    };
    const q = existing ? supabaseClient.from("association_team").update(payload).eq("id", existing.id) : supabaseClient.from("association_team").insert(payload);
    const { error } = await q;
    if (error) { const a = document.getElementById("teamFormAlert"); a.textContent = error.message; a.hidden = false; return; }
    closeModal(); loadTeamRows(year);
  });
}

// ========================================================= FESTIVAL COMMITTEE TEAMS
async function renderFestivalTeam() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Festival Committee Teams</h2>
      <div class="flex items-center gap-8">
        <select id="fcCommittee" style="width:auto;">
          <option value="ganesh">Ganesh Committee</option>
          <option value="durga">Durga Matha Committee</option>
        </select>
        <select id="fcYear" style="width:auto;"></select>
        <button class="btn btn-primary btn-sm" id="btnAddFcMember">+ Add member</button>
      </div>
    </div>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>#</th><th>Position</th><th>Name</th><th>Contact</th><th></th></tr></thead>
      <tbody id="fcBody"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>
    </table></div>`;

  const currentYear = YNC_CONFIG.currentYear;
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  document.getElementById("fcYear").innerHTML = years.map(y => `<option value="${y}" ${y===currentYear?"selected":""}>${y}</option>`).join("");

  const load = () => loadFcRows(COMMITTEES[document.getElementById("fcCommittee").value].id, Number(document.getElementById("fcYear").value));
  document.getElementById("fcCommittee").addEventListener("change", load);
  document.getElementById("fcYear").addEventListener("change", load);
  document.getElementById("btnAddFcMember").addEventListener("click", () =>
    openFcForm(null, COMMITTEES[document.getElementById("fcCommittee").value].id, Number(document.getElementById("fcYear").value)));
  load();
}

async function loadFcRows(committeeId, year) {
  const { data } = await supabaseClient.from("festival_committee_members").select("*").eq("committee_id", committeeId).eq("year", year).order("display_order");
  const body = document.getElementById("fcBody");
  if (!data || data.length === 0) { body.innerHTML = `<tr><td colspan="5" class="text-muted">No members for ${year} yet.</td></tr>`; return; }
  body.innerHTML = data.map((m,i) => `
    <tr>
      <td>${i+1}</td><td>${esc(m.position)}</td><td>${esc(m.name)}</td>
      <td>${esc(m.phone)}${m.email ? " · "+esc(m.email) : ""}</td>
      <td class="flex gap-8">
        <button class="btn btn-ghost btn-sm" data-edit="${m.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${m.id}">Delete</button>
      </td>
    </tr>`).join("");
  body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openFcForm(data.find(m=>m.id===b.dataset.edit), committeeId, year)));
  body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this member?")) return;
    await supabaseClient.from("festival_committee_members").delete().eq("id", b.dataset.del);
    loadFcRows(committeeId, year);
  }));
}

function openFcForm(existing, committeeId, year) {
  openModal(`
    <h3>${existing ? "Edit" : "Add"} committee member — ${year}</h3>
    <div id="fcFormAlert" class="alert alert-error" hidden></div>
    <form id="fcForm">
      <div class="grid grid-2">
        <div class="field"><label>Position</label><input type="text" id="fPosition" value="${esc(existing?.position)}" required></div>
        <div class="field"><label>Name</label><input type="text" id="fName" value="${esc(existing?.name)}" required></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Phone</label><input type="tel" id="fPhone" value="${esc(existing?.phone)}"></div>
        <div class="field"><label>Email</label><input type="email" id="fEmail" value="${esc(existing?.email)}"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Photo URL (optional)</label><input type="url" id="fPhoto" value="${esc(existing?.photo_url)}"></div>
        <div class="field"><label>Display order</label><input type="number" id="fOrder" value="${existing?.display_order ?? 0}"></div>
      </div>
      <div class="flex gap-8"><button class="btn btn-primary" type="submit">Save</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>
    </form>
  `);
  document.getElementById("fcForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      committee_id: committeeId, year,
      position: document.getElementById("fPosition").value.trim(), name: document.getElementById("fName").value.trim(),
      phone: document.getElementById("fPhone").value.trim() || null, email: document.getElementById("fEmail").value.trim() || null,
      photo_url: document.getElementById("fPhoto").value.trim() || null, display_order: Number(document.getElementById("fOrder").value) || 0,
    };
    const q = existing ? supabaseClient.from("festival_committee_members").update(payload).eq("id", existing.id) : supabaseClient.from("festival_committee_members").insert(payload);
    const { error } = await q;
    if (error) { const a = document.getElementById("fcFormAlert"); a.textContent = error.message; a.hidden = false; return; }
    closeModal(); loadFcRows(committeeId, year);
  });
}

// ========================================================= PHOTO GALLERIES
async function renderPhotos() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Photo Galleries</h2>
      <button class="btn btn-primary btn-sm" id="btnAddPhoto">+ Add photo</button>
    </div>
    <div class="pill-tabs" id="photoTargetTabs">
      <button class="pill-tab active" data-t="ganesh">Ganesh Committee</button>
      <button class="pill-tab" data-t="durga">Durga Matha Committee</button>
      <button class="pill-tab" data-t="other">Other Occasions</button>
    </div>
    <div id="photoGrid" class="gallery-grid"></div>`;

  let target = "ganesh";
  document.getElementById("btnAddPhoto").addEventListener("click", () => openPhotoForm(target));
  document.querySelectorAll("#photoTargetTabs .pill-tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#photoTargetTabs .pill-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); target = b.dataset.t; loadPhotoGrid(target);
  }));
  loadPhotoGrid(target);
}

async function loadPhotoGrid(slug) {
  const grid = document.getElementById("photoGrid");
  grid.innerHTML = `<div class="skeleton" style="height:150px;"></div>`;
  const committee = COMMITTEES[slug];
  if (!committee) { grid.innerHTML = ""; return; }
  const { data } = await supabaseClient.from("photos").select("*, occasions(name)").eq("committee_id", committee.id).order("created_at", { ascending: false });
  if (!data || data.length === 0) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📷</div>No photos yet.</div>`; return; }
  grid.innerHTML = data.map(p => `
    <div>
      <img src="${esc(p.thumbnail_url || p.image_url)}">
      <div class="gallery-caption">${esc(p.caption || "")} ${p.occasions ? "· " + esc(p.occasions.name) : ""} ${p.year ? "· " + p.year : ""}</div>
      <button class="btn btn-danger btn-sm" style="margin-top:4px;" data-del="${p.id}">Delete</button>
    </div>`).join("");
  grid.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this photo?")) return;
    await supabaseClient.from("photos").delete().eq("id", b.dataset.del);
    loadPhotoGrid(slug);
  }));
}

async function openPhotoForm(slug) {
  const committee = COMMITTEES[slug];
  let occasionOptions = "";
  if (slug === "other") {
    const { data: occs } = await supabaseClient.from("occasions").select("*").eq("committee_id", committee.id).order("year", { ascending: false });
    occasionOptions = `<div class="field"><label>Occasion</label><select id="pOccasion">${(occs||[]).map(o => `<option value="${o.id}" data-year="${o.year}">${esc(o.name)} (${o.year})</option>`).join("")}</select></div>`;
  }
  openModal(`
    <h3>Add photo — ${esc(committee?.name)}</h3>
    <div id="photoFormAlert" class="alert alert-error" hidden></div>
    <form id="photoForm">
      ${occasionOptions}
      <div class="field"><label>Photo file</label><input type="file" id="pFile" accept="image/*" required></div>
      <div class="grid grid-2">
        <div class="field"><label>Caption</label><input type="text" id="pCaption"></div>
        <div class="field"><label>Year</label><input type="number" id="pYear" value="${YNC_CONFIG.currentYear}"></div>
      </div>
      <div class="flex gap-8"><button class="btn btn-primary" type="submit">Upload</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>
    </form>
  `);
  document.getElementById("photoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById("photoFormAlert");
    const file = document.getElementById("pFile").files[0];
    if (!file) return;
    try {
      const path = `gallery/${slug}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabaseClient.storage.from("public-media").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabaseClient.storage.from("public-media").getPublicUrl(path);

      const occasionSel = document.getElementById("pOccasion");
      const payload = {
        committee_id: committee.id,
        occasion_id: occasionSel ? occasionSel.value : null,
        year: Number(document.getElementById("pYear").value) || YNC_CONFIG.currentYear,
        caption: document.getElementById("pCaption").value.trim() || null,
        image_url: pub.publicUrl,
        thumbnail_url: pub.publicUrl,
        uploaded_by: ME.id,
      };
      const { error } = await supabaseClient.from("photos").insert(payload);
      if (error) throw error;
      closeModal();
      loadPhotoGrid(slug);
    } catch (err) {
      alertBox.textContent = err.message || "Upload failed.";
      alertBox.hidden = false;
    }
  });
}

// ========================================================= RESIDENTS (COLONY INFO)
const STREET_LABELS = { street_3: "Street 3", street_4: "Street 4", street_5: "Street 5" };
let currentStreet = "street_3";
let ALL_RESIDENTS = [];

async function renderResidents() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Residents — Colony Info</h2>
      <div class="flex items-center gap-8">
        <select id="residentStreetSelect" style="width:auto;">
          <option value="street_3">Street 3</option>
          <option value="street_4">Street 4</option>
          <option value="street_5">Street 5</option>
        </select>
        <button class="btn btn-primary btn-sm" id="btnAddResident">+ Add resident</button>
      </div>
    </div>
    <p class="text-muted" style="margin-top:10px; font-size:0.85rem;">Name, address &amp; floor are shown publicly under Colony Info, split into Owner / Tenant tabs by the "Type" field below. Phone &amp; email are admin-only and never sent to the public site.</p>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>SNO</th><th>Type</th><th>Name</th><th>Home Address</th><th>Floor No</th><th>Phone</th><th>Email</th><th></th></tr></thead>
      <tbody id="residentBody"><tr><td colspan="8" class="text-muted">Loading…</td></tr></tbody>
    </table></div>`;

  const sel = document.getElementById("residentStreetSelect");
  sel.value = currentStreet;
  sel.addEventListener("change", () => { currentStreet = sel.value; loadResidents(); });
  document.getElementById("btnAddResident").addEventListener("click", () => openResidentForm(null));
  loadResidents();
}

async function loadResidents() {
  const { data } = await supabaseClient.from("residents").select("*").eq("street", currentStreet).order("resident_type").order("sno");
  ALL_RESIDENTS = data || [];
  const body = document.getElementById("residentBody");
  if (!data || data.length === 0) { body.innerHTML = `<tr><td colspan="8" class="text-muted">No residents recorded for ${STREET_LABELS[currentStreet]} yet.</td></tr>`; return; }
  body.innerHTML = data.map(r => `
    <tr>
      <td>${r.sno}</td>
      <td><span class="badge badge-cat">${esc(r.resident_type)}</span></td>
      <td>${esc(r.full_name)}</td>
      <td>${esc(r.home_address)}</td>
      <td>${esc(r.floor_no)||"—"}</td>
      <td>${esc(r.phone)||"—"}</td>
      <td>${esc(r.email)||"—"}</td>
      <td class="flex gap-8">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button>
      </td>
    </tr>`).join("");
  body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openResidentForm(data.find(r=>r.id===b.dataset.edit))));
  body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this resident record?")) return;
    await supabaseClient.from("residents").delete().eq("id", b.dataset.del);
    loadResidents();
  }));
}

function openResidentForm(existing) {
  const nextSno = existing ? existing.sno : (Math.max(0, ...ALL_RESIDENTS.map(r => r.sno || 0)) + 1);
  openModal(`
    <h3>${existing ? "Edit" : "Add"} resident — ${STREET_LABELS[currentStreet]}</h3>
    <div id="residentFormAlert" class="alert alert-error" hidden></div>
    <form id="residentForm">
      <div class="grid grid-2">
        <div class="field"><label>SNO</label><input type="number" id="rSno" value="${nextSno}" required></div>
        <div class="field"><label>Type</label>
          <select id="rType">
            <option value="owner" ${existing?.resident_type==="owner"?"selected":""}>Owner</option>
            <option value="tenant" ${existing?.resident_type==="tenant"?"selected":""}>Tenant</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Name</label><input type="text" id="rName" value="${esc(existing?.full_name)}" required></div>
      <div class="grid grid-2">
        <div class="field"><label>Home Address</label><input type="text" id="rAddress" value="${esc(existing?.home_address)}" required></div>
        <div class="field"><label>Floor No</label><input type="text" id="rFloor" value="${esc(existing?.floor_no)}"></div>
      </div>
      <hr class="divider">
      <h4>Contact details <span class="field-hint" style="font-weight:400;">(admin-only — never shown on the public site)</span></h4>
      <div class="grid grid-2">
        <div class="field"><label>Phone</label><input type="tel" id="rPhone" value="${esc(existing?.phone)}"></div>
        <div class="field"><label>Email</label><input type="email" id="rEmail" value="${esc(existing?.email)}"></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="rNotes">${esc(existing?.notes)}</textarea></div>
      <div class="flex gap-8"><button class="btn btn-primary" type="submit">Save</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>
    </form>
  `);
  document.getElementById("residentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      street: currentStreet,
      sno: Number(document.getElementById("rSno").value) || 1,
      resident_type: document.getElementById("rType").value,
      full_name: document.getElementById("rName").value.trim(),
      home_address: document.getElementById("rAddress").value.trim(),
      floor_no: document.getElementById("rFloor").value.trim() || null,
      phone: document.getElementById("rPhone").value.trim() || null,
      email: document.getElementById("rEmail").value.trim() || null,
      notes: document.getElementById("rNotes").value.trim() || null,
    };
    const q = existing ? supabaseClient.from("residents").update(payload).eq("id", existing.id) : supabaseClient.from("residents").insert(payload);
    const { error } = await q;
    if (error) { const a = document.getElementById("residentFormAlert"); a.textContent = error.message; a.hidden = false; return; }
    closeModal(); loadResidents();
  });
}

// ========================================================= FINANCES
const FINANCE_SCOPE_LABELS = { association: "Association", ganesh: "Ganesh Committee", durga: "Durga Matha Committee" };
let currentFinanceScope = "association";

async function renderFinances() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Finances</h2>
      <div class="flex items-center gap-8">
        <select id="financeScopeSelect" style="width:auto;">
          <option value="association">Association</option>
          <option value="ganesh">Ganesh Committee</option>
          <option value="durga">Durga Matha Committee</option>
        </select>
        <button class="btn btn-primary btn-sm" id="btnAddFinance">+ Add entry</button>
      </div>
    </div>
    <p class="text-muted" style="margin-top:10px; font-size:0.85rem;">Every entry here appears immediately on the matching public Finance page — no personal data, so keep descriptions colony-appropriate.</p>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
      <tbody id="financeBody"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>
    </table></div>`;

  const sel = document.getElementById("financeScopeSelect");
  sel.value = currentFinanceScope;
  sel.addEventListener("change", () => { currentFinanceScope = sel.value; loadFinanceEntries(); });
  document.getElementById("btnAddFinance").addEventListener("click", () => openFinanceForm(null));
  loadFinanceEntries();
}

async function loadFinanceEntries() {
  const { data } = await supabaseClient.from("finance_entries").select("*").eq("scope", currentFinanceScope).order("entry_date", { ascending: false });
  const body = document.getElementById("financeBody");
  if (!data || data.length === 0) { body.innerHTML = `<tr><td colspan="6" class="text-muted">No entries for ${FINANCE_SCOPE_LABELS[currentFinanceScope]} yet.</td></tr>`; return; }
  body.innerHTML = data.map(f => `
    <tr>
      <td>${window.yncFormatDate(f.entry_date)}</td>
      <td><span class="badge ${f.entry_type==="income"?"badge-resolved":"badge-priority-high"}">${esc(f.entry_type)}</span></td>
      <td>${esc(f.category)}</td>
      <td>${esc(f.description)||"—"}</td>
      <td>₹${Number(f.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
      <td class="flex gap-8">
        <button class="btn btn-ghost btn-sm" data-edit="${f.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${f.id}">Delete</button>
      </td>
    </tr>`).join("");
  body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openFinanceForm(data.find(f=>f.id===b.dataset.edit))));
  body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this finance entry?")) return;
    await supabaseClient.from("finance_entries").delete().eq("id", b.dataset.del);
    loadFinanceEntries();
  }));
}

function openFinanceForm(existing) {
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <h3>${existing ? "Edit" : "Add"} finance entry — ${FINANCE_SCOPE_LABELS[currentFinanceScope]}</h3>
    <div id="financeFormAlert" class="alert alert-error" hidden></div>
    <form id="financeForm">
      <div class="grid grid-2">
        <div class="field"><label>Type</label>
          <select id="fEntryType">
            <option value="expense" ${existing?.entry_type==="expense"?"selected":""}>Expense</option>
            <option value="income" ${existing?.entry_type==="income"?"selected":""}>Income</option>
          </select>
        </div>
        <div class="field"><label>Date</label><input type="date" id="fDate" value="${existing?.entry_date || today}" required></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Category</label><input type="text" id="fCategory" value="${esc(existing?.category)}" placeholder="e.g. Housekeeping, Donations" required></div>
        <div class="field"><label>Amount (₹)</label><input type="number" step="0.01" min="0" id="fAmount" value="${existing?.amount ?? ""}" required></div>
      </div>
      <div class="field"><label>Description (optional)</label><textarea id="fDescription">${esc(existing?.description)}</textarea></div>
      <div class="flex gap-8"><button class="btn btn-primary" type="submit">Save</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>
    </form>
  `);
  document.getElementById("financeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      scope: currentFinanceScope,
      entry_type: document.getElementById("fEntryType").value,
      entry_date: document.getElementById("fDate").value,
      category: document.getElementById("fCategory").value.trim(),
      description: document.getElementById("fDescription").value.trim() || null,
      amount: Number(document.getElementById("fAmount").value) || 0,
    };
    if (!existing) payload.created_by = ME.id;
    const q = existing ? supabaseClient.from("finance_entries").update(payload).eq("id", existing.id) : supabaseClient.from("finance_entries").insert(payload);
    const { error } = await q;
    if (error) { const a = document.getElementById("financeFormAlert"); a.textContent = error.message; a.hidden = false; return; }
    closeModal(); loadFinanceEntries();
  });
}

boot();
