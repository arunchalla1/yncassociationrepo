// Shared logic for a Colony Info street page.
// Usage: initStreetPage({ street: "street_3" });

let __streetRows = [];
let __streetTab = "owner";

async function initStreetPage(opts) {
  const { street } = opts;

  const { data, error } = await supabaseClient.rpc("get_public_residents", { p_street: street });
  const wrap = document.getElementById("streetContent");

  if (error) {
    wrap.innerHTML = `<div class="alert alert-error">Could not load residents for this street right now.</div>`;
    return;
  }
  __streetRows = data || [];

  document.querySelectorAll("#streetTabs .pill-tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#streetTabs .pill-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    __streetTab = b.dataset.t;
    renderStreetTable();
  }));

  renderStreetTable();
}

function renderStreetTable() {
  const wrap = document.getElementById("streetContent");
  const rows = __streetRows.filter(r => r.resident_type === __streetTab)
    .sort((a, b) => (a.sno || 0) - (b.sno || 0));

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">🏠</div>No ${__streetTab === "owner" ? "owners" : "tenants"} recorded for this street yet.</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>SNO</th><th>Name</th><th>Home Address</th><th>Floor No</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.sno ?? "—"}</td>
            <td>${yncEscapeHtml(r.full_name)}</td>
            <td>${yncEscapeHtml(r.home_address)}</td>
            <td>${yncEscapeHtml(r.floor_no || "—")}</td>
          </tr>`).join("")}
      </tbody>
    </table></div>
    <p class="field-hint" style="margin-top:10px;">Phone &amp; email are only visible to the Association — contact the Staff Dashboard for those details.</p>
  `;
}
