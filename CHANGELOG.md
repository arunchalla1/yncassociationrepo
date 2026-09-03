# Changelog

All notable changes to the YNC Association Portal are documented in this file.

## [2.5.1] — 2026-09-03

### Fixed
- **`deploy-cloudflare.bat` could deploy the wrong folder entirely.** If launched in a way
  that starts it in `C:\Windows\System32` (e.g. "Run as administrator" — a Windows quirk,
  not specific to this script), `wrangler pages deploy .` would try to upload System32
  itself, failing with `Pages only supports files up to 25 MiB in size — MRT.exe is 218
  MiB`. Added `cd /d "%~dp0"` at the top so the script always runs from its own folder
  regardless of how it's launched, and it now prints which folder it's about to deploy.

## [2.5.0] — 2026-09-03

### Added
- **"Retire" action on Staff Dashboard → Staff Access**: drops an account to `user` and
  moves it into a collapsed "Retired accounts" section, out of the active list, with a
  "Reactivate" button to undo it. `profiles` gained `retired` (boolean) and `retired_at`
  columns. This doesn't delete the underlying Supabase Auth sign-in (that needs the
  service-role admin API, which this static site never holds client-side) — it removes
  every privilege and hides the account from the active roster, which covers the common
  case of cleaning up demo/test/former-staff accounts.

## [2.4.1] — 2026-09-03

### Fixed
- **Demo admin account had no working mailbox**, so the new "Forgot your password?" flow
  (added in 2.4.0) couldn't reach it — `admin@yncassociation.demo` isn't a deliverable
  domain. Re-pointed the account's sign-in email to `yncassociationteam@gmail.com` (updated
  in `auth.users`, `auth.identities`, and `profiles` together) so it's a normal, resettable
  account like any other. **Sign in with the new email, not the old `.demo` address.**

## [2.4.0] — 2026-09-03

### Added
- **Staff Dashboard → "Staff Access" tab**: any existing admin can now see every account
  (name, email, phone, role, join date) and promote a `user` to `admin` — or remove admin
  access — with one click. This is now the only way to get dashboard access.
- **Self-service password reset**: "Forgot your password?" on the sign-in page emails a
  reset link via Supabase Auth; a new `reset-password.html` page lets the account holder
  set a new password directly. No one — including Claude — needs to know or rotate an
  admin's password by hand anymore. Requires a one-time Supabase dashboard setting (see
  README → Staff Access & Roles).

### Changed
- **Simplified the role model to exactly two roles: `admin` and `user`** (previously
  `resident` / `association` / `admin`). Every account defaults to `user` on signup — no
  dashboard access, identical to the public/no-login view. **Only `admin` accounts can sign
  in to the Staff Dashboard** — the old `association` role (unused — no accounts had it) no
  longer grants dashboard access. This is enforced both in the dashboard's own login gate
  and at the database level (every staff-only Row Level Security policy now checks for
  `admin` specifically), not just hidden in the UI.

## [2.3.1] — 2026-09-03

### Fixed
- **Critical: homepage stats silently failed to load.** `loadHomeData()` chained `.catch()`
  directly onto a Supabase query builder, which isn't a full Promise and has no `.catch()`
  method — this threw synchronously and broke `Promise.all()` before it even started,
  killing the "Residents Listed" stat, recent notices, and the open-complaints count.
  Replaced with a `safeQuery()` helper that `await`s each query inside a real `try/catch`.
- **Critical: working admin login credentials were published in `login.html`'s HTML** (visible
  to anyone via "View Source" on the live public login page). Removed the "Demo credentials"
  block from the page and rotated the account's password in Supabase — the old published
  password no longer works. The new password is documented only in this repo's README.
- **High: "Other Occasions" incorrectly selectable on the Forms page.** `loadCommittees()` in
  `js/forms-page.js` queried every `festival_committees` row with no filter, so a committee
  with no nomination/booking workflow behind it appeared in both dropdowns. Now filtered to
  `slug in (ganesh, durga)` — the only committees Forms actually supports.

## [2.3.0] — 2026-09-03

### Added
- **Receipt/bill attachments on finance entries** (Staff Dashboard → Finances → Add/Edit
  entry): upload a PDF or photo per entry. It's stored and linked publicly with a 🧾 icon
  on the matching Finance page, for auditability.
- **Best-effort auto-read of the uploaded receipt**: when a file is picked, the browser
  tries to read its text (OCR for photos via Tesseract.js, text layer for PDFs via
  pdf.js — both run entirely client-side, no server or API key) and pre-fills the Amount
  and Date fields with its best guess. This is always a starting point, never
  auto-saved — staff must review/correct before hitting Save, and accuracy varies a lot
  with photo quality and receipt layout.
- **CSV bulk import** (Staff Dashboard → Finances → Import CSV): upload a CSV
  (`date, type, category, amount, description` columns) to add many entries to a scope
  at once. Rows are parsed and previewed before import; invalid rows (bad date, wrong
  type, missing category/amount) are listed and skipped rather than silently dropped.

### Changed
- `finance_entries` gained a `receipt_url` column; the Storage bucket's staff-upload
  policy now also allows a `finance-receipts/` folder.

## [2.2.0] — 2026-09-03

### Added
- **New "Forms" page** (`forms.html`, linked in the top nav right after Home): the
  Volunteer Nomination and Anna Prasadam Booking forms moved here from the individual
  committee pages, each now with a **Committee** dropdown (Ganesh / Durga) so one page
  serves both committees instead of duplicating the forms per page. Ganesh/Durga pages
  now just link to Forms from their "Get Involved" card.
- **Check Status tab on Forms**: enter the phone number or email used on a submission to
  see its status (pending/approved/rejected) for both nominations and Anna Prasadam
  bookings — backed by two new SECURITY DEFINER database functions
  (`get_nomination_status`, `get_prasadam_status`) that return only the caller's own
  matching rows, never the full table.
- **Rejection reasons**: Staff Dashboard now asks for a reason when rejecting a
  nomination or Anna Prasadam booking (`rejection_reason` column on both tables); that
  reason is shown to the person on Forms → Check Status. Staff are prompted to phrase it
  the way it should appear publicly, since there's no separate admin-only vs.
  public-facing text.

### Removed
- The "Year" field on the Volunteer Nomination form — it wasn't populating selectable
  options and had no real purpose (nominations are always logged against the current
  year internally).

## [2.1.2] — 2026-09-03

### Added
- **Durga Matha Committee page now has the full "Get Involved" section** (Volunteer
  Nomination + Anna Prasadam Booking tabs), matching the Ganesh Committee page —
  previously it only had the plain nomination form.
- **"Get Involved" nav sub-links**: the Festival Committees dropdown in the top nav now
  lists a "🙋 Get Involved" sub-item under both Ganesh Committee and Durga Matha
  Committee, jumping straight to that section on each page.

### Changed
- **Staff Dashboard → Anna Prasadam** now shows which committee each booking belongs to
  (Ganesh or Durga) and personalizes the approval email accordingly, instead of always
  referencing the Ganesh Committee by name.

## [2.1.1] — 2026-09-03

### Fixed
- **Production deploys weren't reaching the live domain.** The Cloudflare Pages project's
  "Production branch" is set to `yncprod`, but `deploy-cloudflare.bat` was letting
  `wrangler` auto-detect the local git branch (`main`), so every deploy landed as a
  preview (`main.ync-association-portal.pages.dev`) instead of production
  (`ync-association-portal.pages.dev`) — that's why the v2.1.0 "Get Involved" / Anna
  Prasadam features weren't showing on the real site. `deploy-cloudflare.bat` now deploys
  with `--branch=yncprod` explicitly, so it always targets production regardless of the
  local git branch.

## [2.1.0] — 2026-09-03

### Added
- **Ganesh Committee page — "Get Involved" section** with two tabs:
  - Volunteer Nomination (existing form, now surfaced more prominently as its own tab).
  - New **Anna Prasadam slot booking** form (name, phone, optional email, date,
    headcount, notes), backed by a new `prasadam_bookings` table — publicly insertable,
    staff-only to read/update (verified via RLS role simulation).
- **Self-nomination email now mandatory**, enforced both in the form (required field,
  toggled by nomination type) and at the database level (`nominations_self_requires_email`
  check constraint) — that's the contact point used to notify an approved volunteer.
- **Staff Dashboard → Anna Prasadam tab**: pending/approved/rejected filters, approve/reject
  actions.
- **Approval email drafting**: approving a nomination or a prasadam booking now opens a
  pre-filled `mailto:` email (or shows the phone number to call, if no email) so staff can
  notify the person with one more click — no backend email service required. A fully
  automatic version (Supabase Edge Function + email API) is a documented future upgrade.
- Overview tab: added a "Pending Prasadam Slots" stat.

## [2.0.0] — 2026-09-03

### Removed (breaking)
- **Resident accounts.** Sign-up/sign-in is now staff-only (Association/Festival
  Committee members). `signup.html` no longer collects house number, resident type, or
  neighbour info — just name, phone, email, password for a staff account.
- **"My Neighbours" / owner-tenant directory-by-neighbour-links.** The `houses` table,
  `get_my_neighbor_houses()` function, and `public_house_count()` function are dropped.
  `directory.html` is now a redirect stub to `colony-info/index.html` so old links/
  bookmarks don't 404.
- The "My complaints" signed-in view on the complaints page (no resident accounts to
  gate it on anymore); the public complaint form is unchanged and still open to everyone.

### Added
- **Colony Info** menu (Street 3 / Street 4 / Street 5): each street page lists
  residents in separate **Owners** and **Tenants** tabs — SNO, Name, Home Address, Floor
  No. Backed by a new `residents` table (with a `resident_type` column controlling which
  tab a person appears under) and a `get_public_residents()` database function that
  omits phone/email entirely from what the public site can ever receive.
- **Finances** menu (Association / Ganesh Committee / Durga Matha Committee): each is a
  public dashboard with total income, total expenses, running balance, an expense
  category breakdown, and a full transaction table. Backed by a new `finance_entries`
  table, publicly readable (no personal data in it) but staff-only to write.
- **Staff Dashboard:** "Directory" tab replaced with **Residents** (per-street owner/
  tenant CRUD, phone/email admin-only) and a new **Finances** tab (add/edit/delete
  income & expense entries per scope, with a live-updating public page).
- Home page: "Homes" stat replaced with "Residents Listed" (via `public_resident_count()`);
  Quick Access now includes Colony Info and Finances cards.

### Verified
- Live-tested against the Supabase project directly: anonymous role confirmed blocked
  from reading `residents` directly and from writing to `residents` or
  `finance_entries`; `get_public_residents()` confirmed to never return phone/email
  columns; `finance_entries` confirmed publicly readable.

## [1.1.0] — 2026-09-03

### Added
- GitHub-standard project files: `README.md` updates, `CHANGELOG.md`, `LICENSE`, `.gitignore`.

### Changed
- **Owner/Tenant directory privacy model overhauled:**
  - Association admins can now add/edit every house record (owner & tenant name,
    phone, email, occupancy status, notes) from the Staff Dashboard.
  - Residents no longer see the full directory. A new **"My Neighbours"** page
    shows a signed-in resident only the two houses admin-linked as their
    left-side and right-side neighbours — name and occupancy status only.
    Phone numbers and email addresses are never sent to a resident's browser;
    this is enforced in the database via a dedicated `get_my_neighbor_houses()`
    Postgres function, not just hidden in the UI.
  - Added `left_neighbor_house_number` / `right_neighbor_house_number` columns
    to the `houses` table, editable from the Staff Dashboard's Directory tab.
  - Removed direct client-side `SELECT` access to the `houses` table for
    residents; added a `public_house_count()` function so the homepage "Homes"
    stat keeps working without exposing row-level data.
- Sign-up flow: house number, resident type, and phone are now captured in
  Supabase Auth sign-up metadata and copied into the resident's profile by a
  database trigger, removing a race condition where those fields could be
  silently dropped when email confirmation is pending.
- Navigation and footer: "Owners & Tenants" renamed to "My Neighbours" site-wide.

### Fixed
- Eliminated a Row-Level-Security edge case where an anonymous complaint
  submission could fail if the client code ever chained `.select()` after
  `.insert()` (verified the app never does; documented the gotcha).

## [1.0.0] — 2026-08 (initial prototype)

### Added
- Public site: Home, Notice Board, Association Team (year-wise), Festival
  Committees hub (Ganesh, Durga Matha, Other Occasions) with volunteer
  nomination forms and photo galleries, Owner/Tenant Directory, Complaints
  (raise + track, with categorization and staff responses).
- Resident accounts: sign up / sign in, "My complaints" view.
- Staff Dashboard (Association/Admin role): manage notices, complaints &
  responses, nominations, association team, festival committees, photo
  galleries, and the owner/tenant directory.
- Supabase backend: Postgres schema, Row Level Security policies on every
  table, Storage bucket for complaint & gallery photos, demo accounts, and
  seed data for a first click-through.
- Brand: real YNC Association emblem applied site-wide (header, footer,
  favicon, homepage), full colour palette matched to the logo.
- Google Drive folder structure created and shared with
  `yncassociationteam@gmail.com` for official documents and archives outside
  the live database.
