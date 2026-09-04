// YNC Association — Staff dashboard logic
// All writes rely on Supabase RLS: only profiles.role = 'admin' can succeed.

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

// Opens a pre-filled email in the admin's own mail client. The site is static with
// no email-sending backend configured, so this is the "notify by email" mechanism:
// one click here, then the admin's mail app sends it. See README for upgrading to
// fully-automatic sending via a Supabase Edge Function + email API.
function draftEmail(toEmail, subject, body) {
  if (!toEmail) return false;
  window.open(`mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  return true;
}

// ---------- Boot ----------
// Runs once at page load: does the first access check, and — only on success —
// wires up the tabs and starts watching for the session ending later (see
// watchForAccessLoss). checkAdminAccess() itself is also called on its own,
// with no side effects beyond the gate, whenever we just need to re-verify
// (self-demotion in Staff Access, or a live auth-state change).
let TABS_WIRED = false;
async function boot() {
  const ok = await checkAdminAccess();
  if (!ok) return;

  const { data: committees } = await supabaseClient.from("festival_committees").select("*");
  (committees || []).forEach(c => { COMMITTEES[c.slug] = c; });

  if (!TABS_WIRED) { wireTabs(); TABS_WIRED = true; }
  renderTab("overview");
  watchForAccessLoss();
}

// The one place that decides whether this browser tab is allowed to see the
// dashboard right now. Always re-reads the session and role from Supabase —
// never trusts ME/MY_ROLE already sitting in memory — and shows the dashboard
// or the sign-in gate to match. Returns true if the dashboard is (still) showing.
async function checkAdminAccess() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { lockDashboard(); return false; }

  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (!profile || profile.role !== "admin" || profile.retired) { lockDashboard(true); return false; }

  ME = session.user;
  MY_ROLE = profile;
  document.getElementById("gate").style.display = "none";
  document.getElementById("dash").style.display = "block";
  document.getElementById("whoAmI").textContent = `Signed in as ${profile.full_name || ME.email} · role: ${profile.role}`;
  return true;
}

// Watches for the admin session ending *while this tab is already open* —
// signed out from another tab, session/token expired, access revoked by
// another admin — and immediately locks the dashboard back down instead of
// leaving stale admin content (and working Edit/Delete buttons) on screen.
// Two mechanisms, because neither alone reliably covers every real case:
//  1. onAuthStateChange fires for sign-outs Supabase's client itself notices
//     (including, in most browsers, a sign-out from another tab of the same
//     browser via its storage-event sync).
//  2. pageshow/visibilitychange catch what that can miss — e.g. coming back to
//     this exact page via the browser's Back button after signing out, which
//     can restore it from cache (bfcache) without re-running any auth check.
function watchForAccessLoss() {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") lockDashboard();
    else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") checkAdminAccess();
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) checkAdminAccess(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkAdminAccess(); });
}

function lockDashboard(wrongRole) {
  ME = null;
  MY_ROLE = null;
  document.getElementById("dash").style.display = "none";
  document.getElementById("tabContent").innerHTML = ""; // clear out any admin data/edit controls already rendered
  showGate(wrongRole);
  document.getElementById("gate").style.display = "block";
}

function showGate(wrongRole) {
  document.getElementById("gate").innerHTML = wrongRole
    ? `<div class="card gate-card"><div class="icon">🚫</div><h3>Staff access only</h3><p class="text-muted">This dashboard is admin-only. Your account is signed in but doesn't have admin access yet — ask an existing admin to grant it from Staff Dashboard → Staff Access.</p><a href="../index.html" class="btn btn-outline">Back to site</a></div>`
    : `<div class="card gate-card"><div class="icon">🔒</div><h3>Staff sign-in required</h3><p class="text-muted">This dashboard is for Association &amp; Festival Committee staff.</p><a href="../login.html" class="btn btn-primary">Sign in</a></div>`;
}

// ---------- Tab bar: plain tabs + grouped dropdowns (Nominations; Team & Committees) ----------
function wireTabs() {
  // Group dropdown triggers (e.g. "Nominations ▾") toggle their menu open/closed.
  document.querySelectorAll(".pill-tab-group-trigger").forEach(trigger => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = trigger.nextElementSibling;
      const wasOpen = menu.classList.contains("open");
      closeAllTabMenus();
      if (!wasOpen) menu.classList.add("open");
    });
  });
  // Any actual tab button — whether a top-level pill or one inside a dropdown menu.
  document.querySelectorAll("#tabBar [data-tab]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      activateTabUI(btn.dataset.tab);
      renderTab(btn.dataset.tab);
    });
  });
  // Click anywhere else closes an open dropdown.
  document.addEventListener("click", closeAllTabMenus);
}

function closeAllTabMenus() {
  document.querySelectorAll(".pill-tab-menu.open").forEach(m => m.classList.remove("open"));
}

// Updates which pill looks active — including lighting up a group's trigger
// (e.g. "Nominations ▾") when the active tab lives inside its dropdown — without
// rendering anything. Used both by normal tab clicks and by the Overview
// shortcuts (goToTab), which need the tab bar to reflect where they just jumped to.
function activateTabUI(tab) {
  document.querySelectorAll("#tabBar [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".pill-tab-group-trigger").forEach(trigger => {
    const subtabs = (trigger.dataset.subtabs || "").split(",");
    trigger.classList.toggle("active-group", subtabs.includes(tab));
  });
  closeAllTabMenus();
}

function renderTab(tab) {
  ACTIVE_TAB = tab;
  const map = {
    overview: renderOverview, notices: renderNotices, complaints: renderComplaints,
    nominations: renderNominations, team: renderTeam, "festival-team": renderFestivalTeam,
    photos: renderPhotos, residents: renderResidents, finances: renderFinances,
    prasadam: renderPrasadam, staff: renderStaffUsers,
  };
  (map[tab] || renderOverview)();
}

// Overview's stat cards are shortcuts into the section they summarize — this is
// what a click on e.g. "Pending Nominations" actually runs: set whatever filter
// makes the destination show the same thing the stat counted, then switch tabs.
function goToTab(tab, opts) {
  opts = opts || {};
  if (opts.complaintFilter) complaintStatusFilter = opts.complaintFilter;
  if (opts.nominationFilter) nominationStatusFilter = opts.nominationFilter;
  if (opts.prasadamFilter) prasadamStatusFilter = opts.prasadamFilter;
  activateTabUI(tab);
  renderTab(tab);
}

// ========================================================= OVERVIEW
async function renderOverview() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `<div class="grid grid-4" id="ovStats">
    <div class="card skeleton" style="height:90px;"></div><div class="card skeleton" style="height:90px;"></div>
    <div class="card skeleton" style="height:90px;"></div><div class="card skeleton" style="height:90px;"></div>
    <div class="card skeleton" style="height:90px;"></div>
  </div>`;

  const [{ count: openC }, { count: pendingNom }, { count: pendingPrasadam }, { count: residents }, { count: notices }] = await Promise.all([
    supabaseClient.from("complaints").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabaseClient.from("nominations").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabaseClient.from("prasadam_bookings").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabaseClient.from("residents").select("*", { count: "exact", head: true }),
    supabaseClient.from("notices").select("*", { count: "exact", head: true }),
  ]);

  // Each stat is a shortcut into the dashboard section it summarizes, pre-filtered
  // to match what was counted (e.g. "Pending Nominations" lands on the Nominations
  // tab with the Pending filter already selected) — see goToTab().
  document.getElementById("ovStats").innerHTML = `
    <button class="card card-hover stat-card stat-card-link" data-goto="complaints" data-complaint-filter="open"><div class="num">${openC ?? 0}</div><div class="label">Open Complaints</div></button>
    <button class="card card-hover stat-card stat-card-link" data-goto="nominations" data-nomination-filter="pending"><div class="num">${pendingNom ?? 0}</div><div class="label">Pending Nominations</div></button>
    <button class="card card-hover stat-card stat-card-link" data-goto="prasadam" data-prasadam-filter="pending"><div class="num">${pendingPrasadam ?? 0}</div><div class="label">Pending Prasadam Slots</div></button>
    <button class="card card-hover stat-card stat-card-link" data-goto="residents"><div class="num">${residents ?? 0}</div><div class="label">Residents Listed</div></button>
    <button class="card card-hover stat-card stat-card-link" data-goto="notices"><div class="num">${notices ?? 0}</div><div class="label">Total Notices</div></button>
  `;
  document.querySelectorAll("#ovStats [data-goto]").forEach(btn => {
    btn.addEventListener("click", () => goToTab(btn.dataset.goto, {
      complaintFilter: btn.dataset.complaintFilter,
      nominationFilter: btn.dataset.nominationFilter,
      prasadamFilter: btn.dataset.prasadamFilter,
    }));
  });
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
      <button class="pill-tab ${complaintStatusFilter === "all" ? "active" : ""}" data-f="all">All</button>
      <button class="pill-tab ${complaintStatusFilter === "open" ? "active" : ""}" data-f="open">Open</button>
      <button class="pill-tab ${complaintStatusFilter === "in_progress" ? "active" : ""}" data-f="in_progress">In progress</button>
      <button class="pill-tab ${complaintStatusFilter === "resolved" ? "active" : ""}" data-f="resolved">Resolved</button>
      <button class="pill-tab ${complaintStatusFilter === "closed" ? "active" : ""}" data-f="closed">Closed</button>
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
let nominationStatusFilter = "all";
async function renderNominations() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <h2>Volunteer Nominations</h2>
    <div class="pill-tabs" id="nomFilterTabs">
      <button class="pill-tab ${nominationStatusFilter === "all" ? "active" : ""}" data-f="all">All</button>
      <button class="pill-tab ${nominationStatusFilter === "pending" ? "active" : ""}" data-f="pending">Pending</button>
      <button class="pill-tab ${nominationStatusFilter === "approved" ? "active" : ""}" data-f="approved">Approved</button>
      <button class="pill-tab ${nominationStatusFilter === "rejected" ? "active" : ""}" data-f="rejected">Rejected</button>
    </div>
    <div id="nomList"></div>`;

  document.querySelectorAll("#nomFilterTabs .pill-tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#nomFilterTabs .pill-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); nominationStatusFilter = b.dataset.f; loadNominationsList();
  }));
  loadNominationsList();
}

async function loadNominationsList() {
  const list = document.getElementById("nomList");
  list.innerHTML = `<div class="card skeleton" style="height:100px;"></div>`;
  let q = supabaseClient.from("nominations").select("*, festival_committees(name)").order("created_at", { ascending: false });
  if (nominationStatusFilter !== "all") q = q.eq("status", nominationStatusFilter);
  const { data } = await q;

  if (!data || data.length === 0) { list.innerHTML = `<div class="empty-state"><div class="icon">🙌</div>No nominations here.</div>`; return; }

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
      ${n.status === "rejected" && n.rejection_reason ? `<p style="font-size:0.85rem; color:var(--danger);"><strong>Rejection reason (shown to nominee on Check Status):</strong> ${esc(n.rejection_reason)}</p>` : ""}
      ${n.status === "pending" ? `
        <div class="flex gap-8" style="margin-top:8px;">
          <button class="btn btn-primary btn-sm" data-approve="${n.id}">Approve</button>
          <button class="btn btn-danger btn-sm" data-reject="${n.id}">Reject</button>
        </div>` : ""}
    </div>
  `).join("");

  list.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", async () => {
    const n = data.find(x => x.id === b.dataset.approve);
    await supabaseClient.from("nominations").update({ status: "approved" }).eq("id", b.dataset.approve);
    if (n) {
      const committeeName = n.festival_committees?.name || "Festival Committee";
      const closing = n.festival_committees?.slug === "ganesh" ? "Ganpati Bappa Morya!"
        : n.festival_committees?.slug === "durga" ? "Jai Durga Mata!"
        : "";
      const sent = draftEmail(
        n.nominee_email,
        `You're approved as a volunteer — ${committeeName} ${n.year}`,
        `Hi ${n.nominee_name},\n\nGreat news — your nomination to volunteer with the ${committeeName} (${n.year}) has been approved by YNC Association. We'll be in touch with next steps soon.\n\n${closing ? closing + "\n" : ""}— YNC Association`
      );
      if (!sent) alert(`Approved. No email on file for ${n.nominee_name} — let them know some other way.`);
    }
    loadNominationsList();
  }));
  list.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", async () => {
    const n = data.find(x => x.id === b.dataset.reject);
    const reason = prompt(`Why is ${n ? n.nominee_name : "this nomination"} being rejected?\n\nThis reason (rephrased) will be shown to the person on the site's Forms → Check Status page.`);
    if (reason === null) return; // staff cancelled
    await supabaseClient.from("nominations").update({ status: "rejected", rejection_reason: reason.trim() || null }).eq("id", b.dataset.reject);
    loadNominationsList();
  }));
}

// ========================================================= ANNA PRASADAM BOOKINGS
let prasadamStatusFilter = "pending";
async function renderPrasadam() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <h2>Anna Prasadam Slot Bookings</h2>
    <div class="pill-tabs" id="prasadamFilterTabs">
      <button class="pill-tab ${prasadamStatusFilter === "pending" ? "active" : ""}" data-f="pending">Pending</button>
      <button class="pill-tab ${prasadamStatusFilter === "approved" ? "active" : ""}" data-f="approved">Approved</button>
      <button class="pill-tab ${prasadamStatusFilter === "rejected" ? "active" : ""}" data-f="rejected">Rejected</button>
      <button class="pill-tab ${prasadamStatusFilter === "all" ? "active" : ""}" data-f="all">All</button>
    </div>
    <div id="prasadamList"></div>`;

  document.querySelectorAll("#prasadamFilterTabs .pill-tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#prasadamFilterTabs .pill-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); prasadamStatusFilter = b.dataset.f; loadPrasadamList();
  }));
  loadPrasadamList();
}

async function loadPrasadamList() {
  const list = document.getElementById("prasadamList");
  list.innerHTML = `<div class="card skeleton" style="height:100px;"></div>`;
  let q = supabaseClient.from("prasadam_bookings").select("*, festival_committees(name, slug)").order("slot_date", { ascending: true });
  if (prasadamStatusFilter !== "all") q = q.eq("status", prasadamStatusFilter);
  const { data } = await q;

  if (!data || data.length === 0) { list.innerHTML = `<div class="empty-state"><div class="icon">🍚</div>No bookings here.</div>`; return; }

  list.innerHTML = data.map(p => `
    <div class="card" style="margin-bottom:12px;">
      <div class="flex justify-between items-center gap-8" style="flex-wrap:wrap;">
        <span class="badge badge-${p.status}">${esc(p.status)}</span>
        <span class="text-muted" style="font-size:0.8rem;">Requested ${window.yncFormatDateTime(p.created_at)}</span>
      </div>
      <h3 style="margin:10px 0 2px;">${esc(p.full_name)} <span class="text-muted" style="font-weight:400;">— ${window.yncFormatDate(p.slot_date)}${p.festival_committees?.name ? " · " + esc(p.festival_committees.name) : ""}</span></h3>
      <p style="font-size:0.88rem;">📞 <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>${p.email ? " · ✉️ " + esc(p.email) : ""}${p.people_count ? " · ~" + p.people_count + " people" : ""}</p>
      ${p.notes ? `<p style="font-size:0.88rem; background:var(--bg); padding:8px 10px; border-radius:8px;">${esc(p.notes)}</p>` : ""}
      ${p.status === "rejected" && p.rejection_reason ? `<p style="font-size:0.85rem; color:var(--danger);"><strong>Rejection reason (shown to requester on Check Status):</strong> ${esc(p.rejection_reason)}</p>` : ""}
      ${p.status === "pending" ? `
        <div class="flex gap-8" style="margin-top:8px;">
          <button class="btn btn-primary btn-sm" data-approve="${p.id}">Approve &amp; confirm</button>
          <button class="btn btn-danger btn-sm" data-reject="${p.id}">Reject</button>
        </div>` : ""}
    </div>
  `).join("");

  list.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", async () => {
    const p = data.find(x => x.id === b.dataset.approve);
    await supabaseClient.from("prasadam_bookings").update({ status: "approved" }).eq("id", b.dataset.approve);
    if (p) {
      const dateStr = window.yncFormatDate(p.slot_date);
      const committeeName = p.festival_committees?.name || "committee";
      const closing = p.festival_committees?.slug === "ganesh" ? "Ganpati Bappa Morya!"
        : p.festival_committees?.slug === "durga" ? "Jai Durga Mata!"
        : "";
      const sent = draftEmail(
        p.email,
        `Your Anna Prasadam slot is confirmed — ${dateStr}`,
        `Hi ${p.full_name},\n\nYour Anna Prasadam slot for ${dateStr} is confirmed. Thank you for supporting the ${committeeName}!\n\nIf you have questions, call us or reply to this email.\n\n${closing ? closing + "\n" : ""}— YNC Association`
      );
      if (!sent) alert(`Approved. No email on file — call ${p.full_name} at ${p.phone} to confirm.`);
      else alert(`Email drafted. Also consider calling ${p.full_name} at ${p.phone} to confirm directly.`);
    }
    loadPrasadamList();
  }));
  list.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", async () => {
    const p = data.find(x => x.id === b.dataset.reject);
    const reason = prompt(`Why is ${p ? p.full_name : "this slot request"} being rejected?\n\nThis reason (rephrased) will be shown to the person on the site's Forms → Check Status page.`);
    if (reason === null) return; // staff cancelled
    await supabaseClient.from("prasadam_bookings").update({ status: "rejected", rejection_reason: reason.trim() || null }).eq("id", b.dataset.reject);
    loadPrasadamList();
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
    <p class="text-muted" style="margin-top:10px; font-size:0.85rem;">Name, address &amp; floor are shown publicly under Colony Info, split into Owner / Tenant tabs by the "Type" field below. Phone, email, occupancy dates and retired records are admin-only and never sent to the public site — a retired record is dropped from the public site immediately but kept here for history.</p>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>SNO</th><th>Type</th><th>Name</th><th>Home Address</th><th>Floor No</th><th>Occupancy</th><th>Phone</th><th>Email</th><th></th></tr></thead>
      <tbody id="residentBody"><tr><td colspan="9" class="text-muted">Loading…</td></tr></tbody>
    </table></div>
    <div id="retiredResidentsSection" style="margin-top:22px;"></div>`;

  const sel = document.getElementById("residentStreetSelect");
  sel.value = currentStreet;
  sel.addEventListener("change", () => { currentStreet = sel.value; loadResidents(); });
  document.getElementById("btnAddResident").addEventListener("click", () => openResidentForm(null));
  loadResidents();
}

// Owner → "Since <date>"; tenant → "<date> → <date or present>"; nothing set → "—".
function occupancyLabel(r) {
  if (!r.occupied_from) return "—";
  const from = window.yncFormatDate(r.occupied_from);
  if (r.resident_type === "tenant") return `${from} → ${r.vacate_date ? window.yncFormatDate(r.vacate_date) : "present"}`;
  return `Since ${from}`;
}

async function loadResidents() {
  const { data } = await supabaseClient.from("residents").select("*").eq("street", currentStreet).order("resident_type").order("sno");
  ALL_RESIDENTS = data || [];
  const active = ALL_RESIDENTS.filter(r => !r.retired);
  const retired = ALL_RESIDENTS.filter(r => r.retired);

  const body = document.getElementById("residentBody");
  if (active.length === 0) {
    body.innerHTML = `<tr><td colspan="9" class="text-muted">No active residents recorded for ${STREET_LABELS[currentStreet]} yet.</td></tr>`;
  } else {
    body.innerHTML = active.map(r => `
      <tr>
        <td>${r.sno}</td>
        <td><span class="badge badge-cat">${esc(r.resident_type)}</span></td>
        <td>${esc(r.full_name)}</td>
        <td>${esc(r.home_address)}</td>
        <td>${esc(r.floor_no)||"—"}</td>
        <td style="white-space:nowrap;">${occupancyLabel(r)}</td>
        <td>${esc(r.phone)||"—"}</td>
        <td>${esc(r.email)||"—"}</td>
        <td class="flex gap-8">
          <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Edit</button>
          <button class="btn btn-outline btn-sm" data-retire="${r.id}">Retire</button>
          <button class="btn btn-danger btn-sm" data-del="${r.id}">Remove</button>
        </td>
      </tr>`).join("");
    body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openResidentForm(ALL_RESIDENTS.find(r=>r.id===b.dataset.edit))));
    body.querySelectorAll("[data-retire]").forEach(b => b.addEventListener("click", async () => {
      const r = ALL_RESIDENTS.find(x => x.id === b.dataset.retire);
      if (!confirm(`Retire ${r ? r.full_name : "this resident"}? This removes them from the public Colony Info page and this list right away, but keeps the record here — you can reactivate it later.`)) return;
      await supabaseClient.from("residents").update({ retired: true, retired_at: new Date().toISOString() }).eq("id", b.dataset.retire);
      loadResidents();
    }));
    body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Permanently remove this resident record? This can't be undone — use Retire instead if you want to keep the record for history.")) return;
      await supabaseClient.from("residents").delete().eq("id", b.dataset.del);
      loadResidents();
    }));
  }

  const retiredWrap = document.getElementById("retiredResidentsSection");
  if (retired.length === 0) { retiredWrap.innerHTML = ""; return; }
  retiredWrap.innerHTML = `
    <details>
      <summary style="cursor:pointer; font-size:0.9rem; color:var(--text-muted);">Retired residents (${retired.length})</summary>
      <p class="text-muted" style="font-size:0.82rem; margin-top:8px;">Hidden from the public Colony Info page and the list above; kept here so the history isn't lost.</p>
      <div class="table-wrap" style="margin-top:8px;"><table>
        <thead><tr><th>Type</th><th>Name</th><th>Home Address</th><th>Occupancy</th><th>Retired</th><th></th></tr></thead>
        <tbody>
          ${retired.map(r => `
            <tr>
              <td><span class="badge badge-cat">${esc(r.resident_type)}</span></td>
              <td>${esc(r.full_name)}</td>
              <td>${esc(r.home_address)}</td>
              <td style="white-space:nowrap;">${occupancyLabel(r)}</td>
              <td>${r.retired_at ? window.yncFormatDate(r.retired_at) : "—"}</td>
              <td class="flex gap-8">
                <button class="btn btn-outline btn-sm" data-reactivate="${r.id}">Reactivate</button>
                <button class="btn btn-danger btn-sm" data-del="${r.id}">Remove</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table></div>
    </details>`;
  retiredWrap.querySelectorAll("[data-reactivate]").forEach(b => b.addEventListener("click", async () => {
    await supabaseClient.from("residents").update({ retired: false, retired_at: null }).eq("id", b.dataset.reactivate);
    loadResidents();
  }));
  retiredWrap.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Permanently remove this resident record? This can't be undone.")) return;
    await supabaseClient.from("residents").delete().eq("id", b.dataset.del);
    loadResidents();
  }));
}

function openResidentForm(existing) {
  const nextSno = existing ? existing.sno : (Math.max(0, ...ALL_RESIDENTS.map(r => r.sno || 0)) + 1);
  const isTenant = existing?.resident_type === "tenant";
  openModal(`
    <h3>${existing ? "Edit" : "Add"} resident — ${STREET_LABELS[currentStreet]}</h3>
    <div id="residentFormAlert" class="alert alert-error" hidden></div>
    <form id="residentForm">
      <div class="grid grid-2">
        <div class="field"><label>SNO</label><input type="number" id="rSno" value="${nextSno}" required></div>
        <div class="field"><label>Type</label>
          <select id="rType">
            <option value="owner" ${existing?.resident_type==="owner"?"selected":""}>Owner</option>
            <option value="tenant" ${isTenant?"selected":""}>Tenant</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Name</label><input type="text" id="rName" value="${esc(existing?.full_name)}" required></div>
      <div class="grid grid-2">
        <div class="field"><label>Home Address</label><input type="text" id="rAddress" value="${esc(existing?.home_address)}" required></div>
        <div class="field"><label>Floor No</label><input type="text" id="rFloor" value="${esc(existing?.floor_no)}"></div>
      </div>
      <hr class="divider">
      <h4>Occupancy</h4>
      <div class="grid grid-2">
        <div class="field">
          <label id="rOccupiedFromLabel">${isTenant ? "Occupied Date" : "Occupied From"}</label>
          <input type="date" id="rOccupiedFrom" value="${existing?.occupied_from || ""}">
        </div>
        <div class="field" id="rVacateDateField" ${isTenant ? "" : 'style="display:none;"'}>
          <label>Vacate Date</label>
          <input type="date" id="rVacateDate" value="${existing?.vacate_date || ""}">
          <div class="field-hint">Leave blank while the tenant is still occupying.</div>
        </div>
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

  const typeSelect = document.getElementById("rType");
  const vacateField = document.getElementById("rVacateDateField");
  const occLabel = document.getElementById("rOccupiedFromLabel");
  function syncOccupancyFields() {
    const tenantSelected = typeSelect.value === "tenant";
    vacateField.style.display = tenantSelected ? "" : "none";
    occLabel.textContent = tenantSelected ? "Occupied Date" : "Occupied From";
  }
  typeSelect.addEventListener("change", syncOccupancyFields);

  document.getElementById("residentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("rType").value;
    const payload = {
      street: currentStreet,
      sno: Number(document.getElementById("rSno").value) || 1,
      resident_type: type,
      full_name: document.getElementById("rName").value.trim(),
      home_address: document.getElementById("rAddress").value.trim(),
      floor_no: document.getElementById("rFloor").value.trim() || null,
      occupied_from: document.getElementById("rOccupiedFrom").value || null,
      vacate_date: type === "tenant" ? (document.getElementById("rVacateDate").value || null) : null,
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

// ========================================================= STAFF ACCESS
// Anyone can create an account (login.html → "Create an account"); it starts as
// role "user" — no dashboard access, same view of the site as a signed-out visitor.
// An existing admin promotes an account to "admin" here to grant full Staff
// Dashboard access. Only "admin" accounts can sign in to this dashboard at all.
async function renderStaffUsers() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Staff Access</h2>
    </div>
    <p class="text-muted" style="margin-top:10px; font-size:0.85rem;">
      Every new account (via Sign in → Create an account) starts as <strong>user</strong> —
      no dashboard access, the same public view everyone gets without signing in at all.
      Promote someone to <strong>admin</strong> below to give them full Staff Dashboard
      access. Only admins can sign in to this dashboard.
    </p>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th></th></tr></thead>
      <tbody id="staffUsersBody"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>
    </table></div>
    <div id="retiredSection" style="margin-top:22px;"></div>`;
  loadStaffUsers();
}

async function loadStaffUsers() {
  const body = document.getElementById("staffUsersBody");
  const retiredWrap = document.getElementById("retiredSection");
  const { data, error } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) { body.innerHTML = `<tr><td colspan="6" class="text-muted">${esc(error.message)}</td></tr>`; return; }

  const active = (data || []).filter(p => !p.retired);
  const retired = (data || []).filter(p => p.retired);

  if (active.length === 0) { body.innerHTML = `<tr><td colspan="6" class="text-muted">No active accounts.</td></tr>`; }
  else {
    body.innerHTML = active.map(p => `
      <tr>
        <td>${esc(p.full_name)}${p.id === ME.id ? ' <span class="text-muted" style="font-size:0.8em;">(you)</span>' : ""}</td>
        <td>${esc(p.email)}</td>
        <td>${esc(p.phone) || "—"}</td>
        <td><span class="badge ${p.role === "admin" ? "badge-approved" : "badge-cat"}">${esc(p.role)}</span></td>
        <td>${window.yncFormatDate(p.created_at)}</td>
        <td class="flex gap-8">
          ${p.role === "admin"
            ? `<button class="btn btn-outline btn-sm" data-demote="${p.id}">Remove admin</button>`
            : `<button class="btn btn-primary btn-sm" data-promote="${p.id}">Make admin</button>`}
          <button class="btn btn-danger btn-sm" data-retire="${p.id}">Retire</button>
        </td>
      </tr>`).join("");
    body.querySelectorAll("[data-promote]").forEach(b => b.addEventListener("click", () => setUserRole(b.dataset.promote, "admin", data)));
    body.querySelectorAll("[data-demote]").forEach(b => b.addEventListener("click", () => setUserRole(b.dataset.demote, "user", data)));
    body.querySelectorAll("[data-retire]").forEach(b => b.addEventListener("click", () => retireUser(b.dataset.retire, data)));
  }

  if (retired.length === 0) { retiredWrap.innerHTML = ""; return; }
  retiredWrap.innerHTML = `
    <details>
      <summary style="cursor:pointer; font-size:0.9rem; color:var(--text-muted);">Retired accounts (${retired.length})</summary>
      <p class="text-muted" style="font-size:0.82rem; margin-top:8px;">
        Retiring drops an account to <strong>user</strong> (no dashboard access) and hides it
        from the list above. It doesn't delete the underlying sign-in — that needs direct
        database access — but a retired account has no privileges even if it signs in.
      </p>
      <div class="table-wrap" style="margin-top:8px;"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Retired</th><th></th></tr></thead>
        <tbody>
          ${retired.map(p => `
            <tr>
              <td>${esc(p.full_name)}</td>
              <td>${esc(p.email)}</td>
              <td>${p.retired_at ? window.yncFormatDate(p.retired_at) : "—"}</td>
              <td><button class="btn btn-outline btn-sm" data-reactivate="${p.id}">Reactivate</button></td>
            </tr>`).join("")}
        </tbody>
      </table></div>
    </details>`;
  retiredWrap.querySelectorAll("[data-reactivate]").forEach(b => b.addEventListener("click", () => reactivateUser(b.dataset.reactivate)));
}

async function setUserRole(id, newRole, allProfiles) {
  const target = allProfiles.find(p => p.id === id);
  const label = (target && (target.full_name || target.email)) || "this account";
  if (newRole === "user") {
    const adminCount = allProfiles.filter(p => p.role === "admin" && !p.retired).length;
    if (adminCount <= 1 && target && target.role === "admin") {
      alert("You can't remove the last admin — promote someone else to admin first.");
      return;
    }
    if (id === ME.id) {
      if (!confirm("This removes your own admin access — you'll be signed out of this dashboard immediately. Continue?")) return;
    } else if (!confirm(`Remove admin access from ${label}?`)) {
      return;
    }
  } else if (!confirm(`Give ${label} full Staff Dashboard access?`)) {
    return;
  }
  const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("id", id);
  if (error) { alert(error.message); return; }
  if (id === ME.id && newRole === "user") { return checkAdminAccess(); } // re-run the gate check on yourself
  loadStaffUsers();
}

async function retireUser(id, allProfiles) {
  const target = allProfiles.find(p => p.id === id);
  const label = (target && (target.full_name || target.email)) || "this account";
  const adminCount = allProfiles.filter(p => p.role === "admin" && !p.retired).length;
  if (target && target.role === "admin" && adminCount <= 1) {
    alert("You can't retire the last admin — promote someone else to admin first.");
    return;
  }
  if (id === ME.id) {
    if (!confirm("This retires your own account — you'll be signed out of this dashboard immediately. Continue?")) return;
  } else if (!confirm(`Retire ${label}? This drops them to "user" and hides them from the active list. You can reactivate later.`)) {
    return;
  }
  const { error } = await supabaseClient.from("profiles").update({ role: "user", retired: true, retired_at: new Date().toISOString() }).eq("id", id);
  if (error) { alert(error.message); return; }
  if (id === ME.id) { return checkAdminAccess(); }
  loadStaffUsers();
}

async function reactivateUser(id) {
  const { error } = await supabaseClient.from("profiles").update({ retired: false, retired_at: null }).eq("id", id);
  if (error) { alert(error.message); return; }
  loadStaffUsers();
}

// ========================================================= FINANCES
const FINANCE_SCOPE_LABELS = { association: "Association", ganesh: "Ganesh Committee", durga: "Durga Matha Committee" };
let currentFinanceScope = "association";

async function renderFinances() {
  const wrap = document.getElementById("tabContent");
  wrap.innerHTML = `
    <div class="flex justify-between items-center gap-12" style="flex-wrap:wrap;">
      <h2 style="margin:0;">Finances</h2>
      <div class="flex items-center gap-8" style="flex-wrap:wrap;">
        <select id="financeScopeSelect" style="width:auto;">
          <option value="association">Association</option>
          <option value="ganesh">Ganesh Committee</option>
          <option value="durga">Durga Matha Committee</option>
        </select>
        <button class="btn btn-outline btn-sm" id="btnImportCsv">Import CSV</button>
        <button class="btn btn-primary btn-sm" id="btnAddFinance">+ Add entry</button>
      </div>
    </div>
    <p class="text-muted" style="margin-top:10px; font-size:0.85rem;">Every entry here appears immediately on the matching public Finance page — no personal data, so keep descriptions colony-appropriate. Attach a receipt (PDF/photo) on an entry, or import several at once from a CSV.</p>
    <div class="table-wrap" style="margin-top:14px;"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Receipt</th><th></th></tr></thead>
      <tbody id="financeBody"><tr><td colspan="7" class="text-muted">Loading…</td></tr></tbody>
    </table></div>`;

  const sel = document.getElementById("financeScopeSelect");
  sel.value = currentFinanceScope;
  sel.addEventListener("change", () => { currentFinanceScope = sel.value; loadFinanceEntries(); });
  document.getElementById("btnAddFinance").addEventListener("click", () => openFinanceForm(null));
  document.getElementById("btnImportCsv").addEventListener("click", () => openCsvImportModal());
  loadFinanceEntries();
}

async function loadFinanceEntries() {
  const { data } = await supabaseClient.from("finance_entries").select("*").eq("scope", currentFinanceScope).order("entry_date", { ascending: false });
  const body = document.getElementById("financeBody");
  if (!data || data.length === 0) { body.innerHTML = `<tr><td colspan="7" class="text-muted">No entries for ${FINANCE_SCOPE_LABELS[currentFinanceScope]} yet.</td></tr>`; return; }
  body.innerHTML = data.map(f => `
    <tr>
      <td>${window.yncFormatDate(f.entry_date)}</td>
      <td><span class="badge ${f.entry_type==="income"?"badge-resolved":"badge-priority-high"}">${esc(f.entry_type)}</span></td>
      <td>${esc(f.category)}</td>
      <td>${esc(f.description)||"—"}</td>
      <td>₹${Number(f.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
      <td>${f.receipt_url ? `<a href="${esc(f.receipt_url)}" target="_blank" rel="noopener">🧾 view</a>` : "—"}</td>
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
      <div class="field">
        <label>Receipt / bill (optional — PDF or photo)</label>
        <input type="file" id="fReceiptFile" accept="image/*,application/pdf">
        <div class="field-hint">
          ${existing?.receipt_url ? `Current: <a href="${esc(existing.receipt_url)}" target="_blank" rel="noopener">view attached receipt</a>. Choosing a new file replaces it. ` : ""}
          We'll try to auto-read the amount/date from it below — always double-check before saving.
        </div>
        <div id="fReceiptScanStatus" class="text-muted" style="font-size:0.82rem; margin-top:4px;" hidden></div>
      </div>
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
      <div class="flex gap-8"><button class="btn btn-primary" type="submit" id="fSaveBtn">Save</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>
    </form>
  `);

  document.getElementById("fReceiptFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById("fReceiptScanStatus");
    statusEl.hidden = false;
    statusEl.textContent = "Reading document… this can take a few seconds.";
    try {
      const text = await extractTextFromFile(file, (pct) => { statusEl.textContent = `Reading document… ${pct}%`; });
      const amount = guessAmountFromText(text);
      const date = guessDateFromText(text);
      const applied = [];
      if (amount) { document.getElementById("fAmount").value = amount; applied.push(`amount ₹${amount}`); }
      if (date) { document.getElementById("fDate").value = date; applied.push(`date ${date}`); }
      statusEl.textContent = applied.length
        ? `Auto-filled ${applied.join(" and ")} from the document — this is a best-effort guess, please verify before saving.`
        : "Couldn't confidently read an amount or date from this document — please fill them in manually. (It'll still be attached.)";
    } catch (err) {
      statusEl.textContent = "Couldn't read this document automatically — please fill the fields in manually. (It'll still be attached.)";
    }
  });

  document.getElementById("financeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById("financeFormAlert");
    const saveBtn = document.getElementById("fSaveBtn");
    alertBox.hidden = true;
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";

    let receiptUrl = existing?.receipt_url || null;
    const fileInput = document.getElementById("fReceiptFile");
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const path = `finance-receipts/${currentFinanceScope}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabaseClient.storage.from("public-media").upload(path, file);
      if (upErr) {
        alertBox.textContent = upErr.message || "Could not upload the receipt.";
        alertBox.hidden = false;
        saveBtn.disabled = false; saveBtn.textContent = "Save";
        return;
      }
      const { data: pub } = supabaseClient.storage.from("public-media").getPublicUrl(path);
      receiptUrl = pub.publicUrl;
    }

    const payload = {
      scope: currentFinanceScope,
      entry_type: document.getElementById("fEntryType").value,
      entry_date: document.getElementById("fDate").value,
      category: document.getElementById("fCategory").value.trim(),
      description: document.getElementById("fDescription").value.trim() || null,
      amount: Number(document.getElementById("fAmount").value) || 0,
      receipt_url: receiptUrl,
    };
    if (!existing) payload.created_by = ME.id;
    const q = existing ? supabaseClient.from("finance_entries").update(payload).eq("id", existing.id) : supabaseClient.from("finance_entries").insert(payload);
    const { error } = await q;
    saveBtn.disabled = false; saveBtn.textContent = "Save";
    if (error) { alertBox.textContent = error.message; alertBox.hidden = false; return; }
    closeModal(); loadFinanceEntries();
  });
}

// ========================================================= FINANCE CSV IMPORT
function openCsvImportModal() {
  openModal(`
    <h3>Import finance entries — ${FINANCE_SCOPE_LABELS[currentFinanceScope]}</h3>
    <p class="text-muted" style="font-size:0.88rem;">CSV columns (first row = header, any order): <code>date, type, category, amount, description</code> (description optional). Date as <code>yyyy-mm-dd</code> or <code>dd/mm/yyyy</code>; type must be <code>income</code> or <code>expense</code>.</p>
    <div id="csvAlert" class="alert alert-error" hidden></div>
    <div class="field"><input type="file" id="csvFile" accept=".csv,text/csv"></div>
    <div id="csvPreviewWrap" style="margin-top:10px;"></div>
    <div class="flex gap-8" style="margin-top:12px;">
      <button class="btn btn-primary" id="csvConfirmBtn" disabled>Import valid rows</button>
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>
  `);

  let parsedRows = [];

  document.getElementById("csvFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { valid, invalid } = parseFinanceCsv(text);
    parsedRows = valid;

    const wrap = document.getElementById("csvPreviewWrap");
    wrap.innerHTML = `
      <p style="font-size:0.85rem;"><strong>${valid.length}</strong> valid row${valid.length === 1 ? "" : "s"} ready to import${invalid.length ? `, <strong>${invalid.length}</strong> skipped (see below)` : ""}.</p>
      ${valid.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th></tr></thead><tbody>${
        valid.slice(0, 20).map(r => `<tr><td>${esc(r.entry_date)}</td><td>${esc(r.entry_type)}</td><td>${esc(r.category)}</td><td>₹${Number(r.amount).toLocaleString("en-IN")}</td><td>${esc(r.description) || "—"}</td></tr>`).join("")
      }</tbody></table></div>${valid.length > 20 ? `<p class="text-muted" style="font-size:0.8rem;">…and ${valid.length - 20} more.</p>` : ""}` : ""}
      ${invalid.length ? `<div class="alert alert-error" style="margin-top:10px; display:block;">Skipped rows:<br>${invalid.map(x => esc(`Row ${x.row}: ${x.reason}`)).join("<br>")}</div>` : ""}
    `;
    document.getElementById("csvConfirmBtn").disabled = valid.length === 0;
  });

  document.getElementById("csvConfirmBtn").addEventListener("click", async () => {
    if (!parsedRows.length) return;
    const btn = document.getElementById("csvConfirmBtn");
    btn.disabled = true; btn.textContent = "Importing…";
    const rows = parsedRows.map(r => ({ ...r, scope: currentFinanceScope, created_by: ME.id }));
    const { error } = await supabaseClient.from("finance_entries").insert(rows);
    if (error) {
      const a = document.getElementById("csvAlert");
      a.textContent = error.message;
      a.hidden = false;
      btn.disabled = false; btn.textContent = "Import valid rows";
      return;
    }
    closeModal();
    loadFinanceEntries();
  });
}

function parseFinanceCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { valid: [], invalid: [] };
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    date: header.indexOf("date"),
    type: header.indexOf("type"),
    category: header.indexOf("category"),
    amount: header.indexOf("amount"),
    description: header.indexOf("description"),
  };

  const valid = [];
  const invalid = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === "") continue; // blank line

    const rawDate = idx.date >= 0 ? (row[idx.date] || "").trim() : "";
    const rawType = idx.type >= 0 ? (row[idx.type] || "").trim().toLowerCase() : "";
    const rawCategory = idx.category >= 0 ? (row[idx.category] || "").trim() : "";
    const rawAmount = idx.amount >= 0 ? (row[idx.amount] || "").trim().replace(/[₹,]/g, "") : "";
    const rawDescription = idx.description >= 0 ? (row[idx.description] || "").trim() : "";

    const entry_date = normalizeCsvDate(rawDate);
    const amount = parseFloat(rawAmount);
    const entry_type = (rawType === "income" || rawType === "expense") ? rawType : null;

    if (!entry_date) { invalid.push({ row: i + 1, reason: `unrecognized date "${rawDate}"` }); continue; }
    if (!entry_type) { invalid.push({ row: i + 1, reason: `type must be "income" or "expense", got "${rawType}"` }); continue; }
    if (!rawCategory) { invalid.push({ row: i + 1, reason: "missing category" }); continue; }
    if (isNaN(amount) || amount <= 0) { invalid.push({ row: i + 1, reason: `invalid amount "${rawAmount}"` }); continue; }

    valid.push({ entry_date, entry_type, category: rawCategory, amount, description: rawDescription || null });
  }
  return { valid, invalid };
}

function normalizeCsvDate(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const day = Number(d), month = Number(mo);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

// Minimal RFC4180-ish CSV parser: handles quoted fields with embedded commas/newlines/escaped quotes.
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

boot();
