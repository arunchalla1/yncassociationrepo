# Changelog

All notable changes to the YNC Association Portal are documented in this file.

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
