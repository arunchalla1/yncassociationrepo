# YNC Association Portal — Yadaiah Nagar Colony Welfare Association

A working prototype of the official community portal: notices & announcements, the
Association Team (year-wise), Festival Committees (Ganesh, Durga Matha, Other Occasions)
with volunteer nomination forms and photo galleries, street-wise Colony Info listings,
public Finance dashboards, and a resident complaints system with staff responses.

## How it's built

- **Frontend:** plain HTML/CSS/JS (no build step) — easy to host anywhere.
- **Backend:** [Supabase](https://supabase.com) (Postgres + Auth + Storage), project `ync-association`
  (`https://dhdgghzwabfdpgbcueyk.supabase.co`), free tier, in your `arunchalla1's Org`.
  All data access is controlled by Postgres Row Level Security — the public anon key in
  `js/supabase-client.js` is safe to expose in client code by design.
- **File storage:** complaint photos and gallery photos upload directly to a Supabase
  Storage bucket (`public-media`) from the browser. See **Google Drive** below for the
  official document archive.
- **No resident accounts.** Only Association/Festival Committee staff sign in (to reach
  the Staff Dashboard). Everything else — Colony Info, Finances, notices, complaints,
  nominations — is open to the public, with sensitive fields (phone/email) restricted at
  the database level, not just hidden in the UI.

## Folder structure

```
index.html          Home
notices.html         Notice Board & Announcements
team.html             Association Team (year-wise)
complaints.html        Raise a complaint (public, no account needed)
login.html / signup.html   Staff sign-in / staff account creation
directory.html        Redirect stub → colony-info/index.html (kept so old links don't 404)
colony-info/
  index.html            Colony Info hub
  street-3.html          Street 3 — Owners / Tenants tabs
  street-4.html          Street 4 — Owners / Tenants tabs
  street-5.html          Street 5 — Owners / Tenants tabs
finance/
  index.html            Association Finances — public dashboard
  ganesh.html            Ganesh Committee Finances
  durga.html              Durga Matha Committee Finances
festivals/
  index.html            Festival Committees hub
  ganesh.html            Ganesh Committee: team, gallery, nomination form
  durga.html              Durga Matha Committee: team, gallery, nomination form
  other.html               Other Occasions: photo galleries by occasion
admin/
  dashboard.html           Staff dashboard (Association/Admin role only)
  dashboard.js
css/style.css          Shared design system
js/                   Shared Supabase client, nav, page logic (street-page.js, finance-page.js, committee-page.js)
assets/ync-logo.png    Official emblem (background removed)
CHANGELOG.md          Version history
LICENSE                 Usage terms
deploy-cloudflare.bat    One-click Cloudflare Pages deploy (Windows)
github-publish.bat        One-click GitHub repo publish (Windows)
```

## Demo account (delete or change before real launch)

| Role | Email | Password |
|---|---|---|
| Association admin (staff dashboard) | `admin@yncassociation.demo` | `YncDemo@2026` |

## Deploying

No build step — just upload the folder as-is to any static host:

- **Cloudflare Pages / Netlify / Vercel:** drag-and-drop this folder (or connect a git repo).
- **GitHub Pages:** push to a repo, enable Pages on the root.

Whichever you pick, note the URL down — nothing else needs to change (the Supabase
project is already live and independent of where the frontend is hosted).

**Convenience scripts (Windows, double-click to run):**

- `deploy-cloudflare.bat` — signs you in to Cloudflare (first run only) and deploys this
  folder to Cloudflare Pages via `wrangler`. Node.js must be installed.
- `github-publish.bat` — initializes git, commits everything, and (if the
  [GitHub CLI](https://cli.github.com) is installed) creates a private "YNC Portal"
  repo on your GitHub account and pushes to it in one step. Without the GitHub CLI it
  still does the local git setup and prints the two commands to finish manually.

**After any content/code change**, re-run `deploy-cloudflare.bat` to push the update live.

## Colony Info — owner/tenant listings & privacy model

- **Public (Colony Info → Street 3/4/5):** each street page has separate **Owners** and
  **Tenants** tabs, listing SNO, Name, Home Address, and Floor No. Phone and email are
  never sent to the public site — the page calls a database function
  (`get_public_residents`) whose return columns simply don't include them, so there's no
  way to obtain them even by inspecting network requests.
- **Association staff (Staff Dashboard → Residents tab):** full read/write access per
  street, including phone and email. A "Type" field (Owner/Tenant) controls which public
  tab a resident appears under.

## Finances — public transparency dashboards

- **Association Finances**, **Ganesh Committee Finances**, and **Durga Matha Committee
  Finances** are separate public pages, each showing total income, total expenses,
  running balance, an expense-by-category breakdown, and a full transaction list.
- No personal data lives in finance records, so the ledger itself is public by design —
  only staff can add, edit, or delete entries (Staff Dashboard → Finances tab, with a
  street-style scope selector for Association / Ganesh / Durga).
- Add an entry with a type (Income/Expense), date, category, optional description, and
  amount — it appears on the matching public page immediately.

## What's already verified working

- Full database schema, Row Level Security policies, and Storage bucket applied and
  tested directly against the live project: public can read notices/team/committees/
  Colony Info/Finances; anyone can submit a complaint or nomination; only staff
  (`association`/`admin` role) can publish notices, manage teams, edit residents, or add
  finance entries; anonymous/authenticated roles were confirmed **blocked** from writing
  to `residents` and `finance_entries` and from reading `residents` directly (phone/email
  columns are unreachable from the public site).
- Demo account, seed data (3 festival committees, 2026 Association Team placeholders, 4
  sample notices, a handful of placeholder residents per street, and sample finance
  entries) are live in the database — replace these with real data from the dashboard.

**Not yet verified with a real browser hitting the internet:** this build environment's
network is restricted to package registries, so live Supabase calls (sign up, submit a
complaint, upload a photo, etc.) couldn't be click-tested from here — the equivalent
logic was verified directly at the database level instead. Please do one full
click-through on the live site and flag anything that looks off, especially the staff
sign-up email confirmation flow and file uploads.

## Google Drive

Your connected Google account is `challaarun@gmail.com`, not `yncassociationteam@gmail.com`
— so a folder structure was built in your Drive and shared with
`yncassociationteam@gmail.com` as an editor:

```
YNC Association/
  01 - Official Documents/
  02 - Owner & Tenant Records/
  03 - Complaint Attachments Archive/
  04 - Notices & Announcements/
  05 - Festival Committees/{Ganesh Committee, Durga Matha Committee, Other Occasions}/
  06 - Photo Galleries Master Archive/{Ganesh, Durga, Other Occasions}/
  07 - Financial Records/
```

This is for official documents, bulk photo backups, and financial records the
Association keeps outside the website. The website itself uses Supabase Storage for
complaint photos and gallery uploads.

To have future automated actions (uploads, emails) happen directly from
`yncassociationteam@gmail.com`, connect that account's Gmail/Drive in Claude's
connector settings — right now this session is only connected to your personal Gmail/Drive.

## Content still needed from you

Seed/placeholder data is live so every page has something to show, but needs your real
information — all editable from the **Staff Dashboard**:
- Association Team 2026 names (currently "To be updated" placeholders)
- Ganesh & Durga committee members for 2026
- Real resident records per street (Residents tab) — SNO, name, address, floor,
  owner/tenant type, plus phone/email for the admin-only view
- Real income/expense entries for Association, Ganesh, and Durga Finances (Finances tab)
  — current entries are ₹0 placeholders
- Any notices/announcements you want live now

Sign in as the admin demo account, or your own account once you set its role to
`association`/`admin` in the `profiles` table.

## Suggested enhancements

- **Search & filter on Colony Info** — a quick "find my house" search box across all
  three streets, plus sort by SNO/name.
- **Finance charts** — a month-by-month income vs. expense trend chart (not just
  category totals) for a faster read on cash flow over time.
- **Receipt attachments on finance entries** — let staff attach a photo of the bill to
  each expense (same storage pattern already used for complaints/gallery photos), with a
  small 🧾 icon linking to it on the public page for full auditability.
- **Complaint status lookup by phone number** — since residents no longer have accounts,
  a simple "enter your phone number to see your complaint's status" lookup would restore
  the tracking convenience "My complaints" used to offer, without needing a login.
- **SMS/WhatsApp notice broadcast** for urgent notices, and **email notifications** when
  a complaint gets a staff response.
- **Custom domain** instead of the `*.pages.dev` URL, for a more official feel.
- **Maintenance-dues module**: track per-house dues alongside the Finance ledger, so
  "who's paid this quarter" becomes answerable from the same data.
- **Role-based staff scoping**: let a Ganesh/Durga committee member manage only their
  own committee's team/gallery/finances, reserving full access for `admin`.
- **Google Drive sync** for uploaded gallery/complaint photos, so the Drive archive stays
  a complete backup automatically instead of a separate manual step.
