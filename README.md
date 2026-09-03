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
- **Two roles: `admin` and `user`.** Only `admin` accounts can sign in to the Staff
  Dashboard. Anyone can create an account (`signup.html`), but it starts as `user` — no
  dashboard access, the exact same view of the site as a signed-out visitor. An existing
  admin promotes an account to `admin` from Staff Dashboard → **Staff Access**. Everything
  public — Colony Info, Finances, notices, complaints, nominations — never required an
  account at all, with sensitive fields (phone/email) restricted at the database level,
  not just hidden in the UI.

## Folder structure

```
index.html          Home
forms.html           Forms: Volunteer Nomination, Anna Prasadam Booking, Check Status
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
  ganesh.html            Ganesh Committee: team & gallery (forms live on forms.html)
  durga.html              Durga Matha Committee: team & gallery (forms live on forms.html)
  other.html               Other Occasions: photo galleries by occasion
admin/
  dashboard.html           Staff dashboard (admin role only)
  dashboard.js
reset-password.html    Self-service "set a new password" page (reached via the emailed reset link)
css/style.css          Shared design system
js/                   Shared Supabase client, nav, page logic (street-page.js, finance-page.js, committee-page.js, forms-page.js)
assets/ync-logo.png    Official emblem (background removed)
CHANGELOG.md          Version history
LICENSE                 Usage terms
deploy-cloudflare.bat    One-click Cloudflare Pages deploy (Windows)
github-publish.bat        Pushes to github.com/arunchalla1/yncassociationrepo (yncprod branch)
```

## Staff Access & Roles

Every account is one of exactly two roles, stored in `profiles.role`:

- **`user`** (default for every new signup) — no dashboard access. Since Colony Info,
  Finances, notices, complaints, and Forms were never login-gated to begin with, a `user`
  account sees exactly what a signed-out visitor sees. Signing up doesn't unlock anything
  by itself.
- **`admin`** — full Staff Dashboard access.

**Granting access:** anyone can create an account at `login.html` → "Create an account" —
it starts as `user`. An existing admin then signs in, opens **Staff Dashboard → Staff
Access**, and clicks "Make admin" next to that person's name. That's the only way to reach
the dashboard; there's no self-service upgrade path, by design.

**Retiring an account:** click "Retire" next to a name to drop it to `user` and move it out
of the active list into a collapsed "Retired accounts" section (with a "Reactivate" button
to bring it back). This is for stale/demo/former-staff accounts you want out of the way
without deleting them. Note it's not the same as deleting the account — the underlying
Supabase Auth sign-in still exists and could still authenticate, it just has zero
privileges once it does. A true delete needs Supabase's admin API (a service-role key,
which this static site intentionally never holds client-side) — ask Claude to remove one
directly via the database if you need that.

**Password resets are self-service**, so an admin's password never needs to be shared or
looked up by anyone else again: "Forgot your password?" on the sign-in page emails a reset
link (Supabase Auth handles this — no code here ever sees or stores the new password). This
needs one **one-time setup step in the Supabase dashboard**: Authentication → URL
Configuration → add `https://ync-association-portal.pages.dev/reset-password.html` (and,
if you use a custom domain later, that domain's equivalent) to **Redirect URLs** — Claude's
tools can't reach that setting, so this one step needs to be done by hand, once.

## Demo account (delete or change before real launch)

| Role | Sign-in email | Password |
|---|---|---|
| Admin (staff dashboard) | `yncassociationteam@gmail.com` | `UzhFYTVimzt73s_1` |

This account was originally seeded as `admin@yncassociation.demo`. That domain isn't a
real, deliverable mailbox, so a password-reset link sent to it would go nowhere — on
2026-09-03 its sign-in email was changed (in Supabase Auth directly: `auth.users`,
`auth.identities`, and `profiles` all updated together) to `yncassociationteam@gmail.com`,
the association's real inbox already used elsewhere in this project (see **Google Drive**
below). **Sign in with the new email above, not the old `.demo` one** — the old address no
longer exists on this account. From here on, "Forgot your password?" on the sign-in page
works normally for it, as long as `yncassociationteam@gmail.com` is a real inbox someone
checks.

The password above still lives only in this README, not on the live site — an earlier
version of `login.html` displayed it directly in the page's HTML, which was removed and the
password rotated on 2026-09-03 (see CHANGELOG). Treat this table as sensitive: fine in your
private repo, never post it publicly. `challaarun@gmail.com` is also already an admin (see
**Staff Access & Roles**), so this shared account can be retired once you're comfortable
relying on personal accounts instead.

## Deploying

No build step — just upload the folder as-is to any static host:

- **Cloudflare Pages / Netlify / Vercel:** drag-and-drop this folder (or connect a git repo).
- **GitHub Pages:** push to a repo, enable Pages on the root.

Whichever you pick, note the URL down — nothing else needs to change (the Supabase
project is already live and independent of where the frontend is hosted).

**Convenience scripts (Windows, double-click to run):**

- `deploy-cloudflare.bat` — signs you in to Cloudflare (first run only) and deploys this
  folder to Cloudflare Pages via `wrangler`. Node.js must be installed.
- `github-publish.bat` — commits everything and pushes to the existing GitHub repo
  [arunchalla1/yncassociationrepo](https://github.com/arunchalla1/yncassociationrepo),
  branch `yncprod`. Git must be installed; if this is the first push, a browser window
  opens for you to sign in to GitHub (handled automatically by Git's credential manager
  — no separate login step).

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

## Forms (forms.html) — Volunteer Nominations, Anna Prasadam Bookings, Check Status

The **Forms** page (top nav, right after Home) has three tabs and serves both Ganesh and
Durga committees via a Committee dropdown on each form:

- **Volunteer Nomination:** choose a committee, then nominate yourself or someone else.
  **Self-nominations require an email** (enforced in the form and at the database level)
  — that's how the approved volunteer gets notified. Nominations go to Staff Dashboard →
  Nominations for approval.
- **Anna Prasadam Booking:** choose a committee, then request a date to sponsor/help
  serve Anna Prasadam during the festival (name, phone — required, email optional, date,
  headcount, notes). Requests go to Staff Dashboard → Anna Prasadam for approval.
- **Check Status:** enter the phone number or email used on a submission to see whether
  it's pending, approved, or rejected. If rejected, the reason staff gave is shown here.
  This is backed by two database functions (`get_nomination_status`,
  `get_prasadam_status`) that only ever return the caller's own matching rows — never
  anyone else's.

The Ganesh and Durga Committee pages keep their team roster and photo gallery, with a
"Get Involved" card pointing to the Forms page.

**Rejection reasons:** when staff reject a nomination or Prasadam booking in the Staff
Dashboard, they're prompted for a reason. That text is stored as-is and shown to the
person on Forms → Check Status — there's no separate internal/public version, so staff
should phrase it the way they'd want the resident to read it.

**How the email notification works:** this site is static with no backend email service
configured, so there's no server that can send mail on its own. Instead, when staff click
**Approve** on a nomination or a prasadam booking, the dashboard opens a pre-filled email
(via `mailto:`) addressed to the person, in the admin's own mail app — one more click and
it's sent. For prasadam bookings without an email on file, the dashboard shows the phone
number for staff to call instead. This works today with zero setup. If you'd rather have
it send automatically with no admin click, that needs a small **Supabase Edge Function**
wired to an email API (e.g. Resend's free tier) — happy to build that once you have an
API key for one.

## Finances — public transparency dashboards

- **Association Finances**, **Ganesh Committee Finances**, and **Durga Matha Committee
  Finances** are separate public pages, each showing total income, total expenses,
  running balance, an expense-by-category breakdown, and a full transaction list.
- No personal data lives in finance records, so the ledger itself is public by design —
  only staff can add, edit, or delete entries (Staff Dashboard → Finances tab, with a
  street-style scope selector for Association / Ganesh / Durga).
- Add an entry with a type (Income/Expense), date, category, optional description, and
  amount — it appears on the matching public page immediately.
- **Receipts:** attach a PDF or photo to any entry — it's linked publicly with a 🧾 icon
  for auditability. When you pick a file, the browser tries to auto-read the amount and
  date from it (OCR for photos, text extraction for PDFs — all client-side, no API key)
  and pre-fills those fields. **Always double-check the pre-filled values** — this is a
  best-effort guess, not a guarantee, and accuracy drops for blurry photos or unusual
  receipt layouts. It still attaches the file even if it can't read anything.
- **CSV import:** for adding many entries at once, use "Import CSV" on the Finances tab.
  Expected columns (header row required, any order): `date, type, category, amount,
  description` (description optional; date as `yyyy-mm-dd` or `dd/mm/yyyy`; type is
  `income` or `expense`). You'll see a preview of what will be imported and what's being
  skipped (with the reason) before anything is saved.

## What's already verified working

- Full database schema, Row Level Security policies, and Storage bucket applied and
  tested directly against the live project: public can read notices/team/committees/
  Colony Info/Finances; anyone can submit a complaint or nomination; only staff
  (`admin` role) can publish notices, manage teams, edit residents, or add
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

Sign in as the admin demo account, or your own account once an existing admin promotes it
from Staff Dashboard → Staff Access (see **Staff Access & Roles** above).

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
