// Shared logic for a public Finance dashboard page.
// Usage: initFinancePage({ scope: "association" });

function inr(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function initFinancePage(opts) {
  const { scope } = opts;

  const { data, error } = await supabaseClient
    .from("finance_entries")
    .select("*")
    .eq("scope", scope)
    .order("entry_date", { ascending: false });

  const summaryWrap = document.getElementById("financeSummary");
  const categoryWrap = document.getElementById("financeCategories");
  const tableWrap = document.getElementById("financeTable");

  if (error) {
    summaryWrap.innerHTML = `<div class="alert alert-error" style="grid-column:1/-1;">Could not load finance data right now.</div>`;
    return;
  }

  const rows = data || [];
  const totalIncome = rows.filter(r => r.entry_type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = rows.filter(r => r.entry_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const balance = totalIncome - totalExpense;

  summaryWrap.innerHTML = `
    <div class="card stat-card"><div class="num" style="color:var(--success);">${inr(totalIncome)}</div><div class="label">Total Income</div></div>
    <div class="card stat-card"><div class="num" style="color:var(--danger);">${inr(totalExpense)}</div><div class="label">Total Expenses</div></div>
    <div class="card stat-card"><div class="num">${inr(balance)}</div><div class="label">Balance</div></div>
  `;

  // Category breakdown (expenses only — the useful "where did the money go" view)
  const byCategory = {};
  rows.filter(r => r.entry_type === "expense").forEach(r => {
    byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount);
  });
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (catEntries.length === 0) {
    categoryWrap.innerHTML = `<div class="empty-state"><div class="icon">📊</div>No expenses recorded yet.</div>`;
  } else {
    const maxVal = Math.max(...catEntries.map(([, v]) => v)) || 1;
    categoryWrap.innerHTML = catEntries.map(([cat, val]) => `
      <div style="margin-bottom:12px;">
        <div class="flex justify-between" style="font-size:0.88rem; margin-bottom:4px;">
          <span>${yncEscapeHtml(cat)}</span><strong>${inr(val)}</strong>
        </div>
        <div style="background:var(--bg); border-radius:999px; height:8px; overflow:hidden;">
          <div style="background:var(--accent); height:100%; width:${(val / maxVal) * 100}%;"></div>
        </div>
      </div>
    `).join("");
  }

  if (rows.length === 0) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="icon">🧾</div>No transactions recorded yet.</div>`;
    return;
  }
  tableWrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Receipt</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${yncFormatDate(r.entry_date)}</td>
            <td><span class="badge ${r.entry_type === "income" ? "badge-resolved" : "badge-priority-high"}">${r.entry_type}</span></td>
            <td>${yncEscapeHtml(r.category)}</td>
            <td>${yncEscapeHtml(r.description || "—")}</td>
            <td style="color:${r.entry_type === "income" ? "var(--success)" : "var(--danger)"}; font-weight:600;">
              ${r.entry_type === "income" ? "+" : "−"}${inr(r.amount)}
            </td>
            <td>${r.receipt_url ? `<a href="${yncEscapeHtml(r.receipt_url)}" target="_blank" rel="noopener" title="View attached receipt">🧾</a>` : "—"}</td>
          </tr>`).join("")}
      </tbody>
    </table></div>
  `;
}
