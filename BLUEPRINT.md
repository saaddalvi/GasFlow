# Build Blueprint: a GasPack-style cylinder tracking app 
# name of web app is GasFlow

## READ THIS FIRST (instructions for Claude Code)

> **Read [the decisions spec](.scratch/gasflow/spec.md) before anything else.** It records decisions agreed on 26 November 2026 and **overrides this blueprint wherever they conflict**, including section 0, section 10 and the ground rules below. Use the domain terms in [GLOSSARY.md](GLOSSARY.md), and see [docs/adr/](docs/adr/) for the reasons behind the decisions that are costly to reverse.

You are building a new web application from this document. It is modelled on an existing product (GasPack Counts), but the **owner's changes in section 0 and the stack in section 10 override everything else**. Sections 1 to 9 describe the original product for reference; where they mention Django, HTMX, a warehouse/godown, internal transfers or a Return-from-customer bill form, ignore that and follow sections 0 and 10.

Ground rules:
1. **Stack:** Next.js (App Router, TypeScript, Tailwind) + Node.js API (Fastify) + PostgreSQL (Prisma + raw SQL for reports) + **Clerk** for auth. Monorepo with a shared Zod package. See section 10.
2. **Staff-only app.** No public sign-up, no customer login. Clerk is invitation-only.
3. **One shop** holds all stock. There is no warehouse and no internal transfer.
4. **Stock is never edited directly.** It is calculated from posted bills (section 10.4).
5. **Returns are mapped to dispatch bills** through `return_allocations` (Change A). This is the most important feature; build it carefully and test it.
6. Follow the build order in section 11. After each step, run the app and the tests before moving on. Write tests for the two key queries (stock balance and pending returns) before building the screens that use them.
7. **Before you start, ask the owner for what you cannot invent:** Clerk publishable and secret keys, the Postgres connection string (or use Docker Compose locally), the shop name, the list of gases to seed, the bill-number prefix for auto-generated returns, and any business logo.
8. Keep secrets in `.env` files (never commit them). Provide `.env.example`.
9. Currency/prices/GST are **out of scope** for now (the original tracks cylinders only).

Open questions to confirm with the owner while building (do not block on them; pick the simplest default and note it):
- Should **dispatch** also get a quicker entry form, or remain a full bill with the paper bill number? (Default: full bill.)
- Track individual **cylinder serial numbers**, or count by gas only? (Default: count by gas.)
- Show/store the shop's own name and address on printouts? (Default: name only.)


Reverse-engineered from https://demogas.gaspack.in (live demo), https://gaspack.in (marketing site) and its sign-in page, by reading the rendered pages, page source, loaded scripts and form fields in a real browser. Anything marked **(inferred)** is a conclusion from what the front end reveals, not something the site states. The server code and database are not visible, so the data model and business rules below are a reconstruction you should validate.

---

## 0. Your modifications (these override anything below that conflicts)

### Change A: "Receive empties" that maps returns to the original dispatch bill

**Problem in the original:** to take empties back, staff create a whole new "Return from customer" bill (type, serial, date, From, To, lines). The return is not linked to the dispatch bill it belongs to, so nobody can see "bill 1234 sent 5, 3 came back, 2 still out".

**New behaviour:** each dispatch bill tracks its own returns. To receive empties, staff pick the customer, see that customer's open dispatch bills, and type how many came back against each one. No serial number, no From/To, no gas dropdowns to fill in.

**Example:** John Doe has bill **1234** with 5 Industrial oxygen out. He returns 3 empties. Staff open Receive empties, choose John Doe, see `1234 · 25 Nov · Industrial oxygen · sent 5 · returned 0 · pending 5`, type `3`, tap Save. Bill 1234 now shows returned 3, pending 2, and the 3 empties are recorded against serial 1234.

**Screen (route `/app/returns/new/`, also opened from the customer's page with the customer preselected)**
1. **Customer** picker (searchable, focused on load). Each option shows total pending, e.g. `John Doe · 5 pending`.
2. After choosing a customer, show a list of that customer's **open dispatch bills**, oldest first. One row per bill and gas:

   | Bill | Date | Gas | Sent | Returned | Pending | Returning now |
   |---|---|---|---|---|---|---|
   | 1234 | 25 Nov | Industrial oxygen | 5 | 0 | **5** | `[ 3 ]` + "All 5" button |

   Fully returned bills are hidden (a "Show closed bills" link reveals them). Days out is shown per bill ("12 days") so overdue ones stand out.
3. Staff type a number in "Returning now" for each bill that has returns, or tap **All N** to fill the pending amount. A **"Fill oldest first"** field lets them type a single total (e.g. 8) and have it spread across the oldest open bills automatically; they can adjust the split before saving.
4. Date defaults to today ("Today · change" link). State defaults to **Empty** (small toggle per row for Filled or Defective).
5. One button: **Save returns**.

**What the app records (this is the key data change)**
- A return is stored as a **return bill with lines that each point at the dispatch line they settle**. Concretely, add an allocation table:
  `ReturnAllocation(id, return_line -> BillLine, dispatch_line -> BillLine, quantity)`
  and generate the return bill automatically: `type = return_from_customer`, `from = customer`, `to = the shop`, `paper_kind = quick_entry`, generated serial like `RET-20261126-001` (prefix configurable), posted immediately, entered-by = signed-in user.
  One Save can produce one return bill that allocates across several dispatch bills.
- Because it is still a normal posted return bill, **all the existing stock, balance and report logic keeps working unchanged**. The allocation table only adds the link back to the dispatch bill.
- Pending per dispatch line = dispatched quantity minus the sum of allocations against it. A dispatch bill is **Open** (pending > 0), **Partly returned**, or **Closed** (pending = 0).

**Show it on the dispatch bill and elsewhere**
- **Bill detail page** for a dispatch bill gets a "Returns" panel: a header line `Sent 5 · Returned 3 · Pending 2` with a status tag (Open / Partly returned / Closed), then a list of each return (date, quantity, return bill number, who entered it).
- **Bills list**: add a "Returned" column for dispatch bills (e.g. `3 / 5`) and a status filter "Pending returns".
- **Party (customer) page**: "Holds now" is replaced/extended by a per-bill list of open bills with days out. This replaces the old "oldest unreturned, first out first back" guess with real bill-by-bill data.
- **Dashboard**: add a "Pending returns" card (total cylinders not yet returned, number of customers) linking to a list sorted by days out.
- **Stock card / balance register**: still work from totals; add the bill serial to the stock-card rows so each return line shows "against 1234".

**Rules and edge cases**
- **Cannot return more than pending on a bill** in the normal flow (hard check per row). If a customer returns more than the records show, allow an **"Other / not on a bill"** row that records the return with no allocation (shown flagged as "unallocated" so someone can fix it later).
- **Partial returns** over several days are fine: each creates its own allocation against the same dispatch line.
- **Multi-gas bills**: pending is tracked per gas line, so a bill with 5 oxygen and 2 nitrogen can be closed gas by gas.
- **Same gas on several open bills**: the "Fill oldest first" helper distributes the total oldest bill first, and shows the proposed split for confirmation.
- **Correcting or cancelling a return bill** also reverses its allocations, so pending on the dispatch bill goes back up. Correcting a dispatch bill that already has returns must not reduce its quantity below what has been returned (block with a clear message).
- **Undo:** after saving, a toast "Recorded: John Doe returned 3 against bill 1234" with an **Undo** link (cancels the return bill, reason "Data entry error") for about 10 seconds.
- **Opening stock:** cylinders a customer already held before the system started have no dispatch bill. Record them as opening stock and show them as a separate "Opening stock" row in the Receive empties list so returns against them can also be allocated (treat the opening entry as a pseudo dispatch with serial "OPENING").
- **Data migration:** if you ever import old data, dispatch lines that were returned under the old unlinked scheme can be auto-allocated first-out, first-back.

### Change B: a single store (remove the godown)

The agency has **one place** where cylinders are kept: the **Shop**.

- Party types become: **Shop (exactly one, created at setup, cannot be deleted)**, **Customer**, **Refiller**, **Supplier**. Remove **Warehouse**.
- Remove the **Internal transfer** bill type entirely (it only moved cylinders between two own locations). Bill types are now: `dispatch_to_customer`, `return_from_customer`, `send_to_refiller`, `return_from_refiller`.
- **No From/To own-location picking anywhere.** The shop is implied:
  - Dispatch to customer: From = Shop (hidden), choose only the customer.
  - Return from customer: To = Shop (hidden), choose only the customer (this is what Change A does).
  - Send to refiller: From = Shop (hidden), choose the refiller.
  - Return from refiller: To = Shop (hidden), choose the refiller.
  In the New bill form, show a single "Customer" or "Refiller" picker whose label changes with the Type. Store `from_party`/`to_party` on the bill as before so the reports still work.
- **Stock report:** one location group ("Shop": Filled / Empty / Defective) instead of two, then With customers, At refiller, Total.
- **Day ledger:** drop the Location selector. It is always the shop. Keep date and prev/next.
- **Dashboard:** "In your stock" is the shop's count. Change "7 at your locations" to just "at the shop". The "Counts below zero" card and the party-balance report stay.
- **Insights/Explore:** remove the "Location" split option.
- **Onboarding:** during setup, ask only for the shop name. Opening stock is entered once for the shop, then once per customer already holding cylinders.
- **Data model:** a one-row-per-firm Shop record (still a `Party` of type `shop` is the simplest way to keep every report query unchanged).

---

## 1. What the product is

Cylinder stock and tracking software for medical and industrial gas agencies (India market: the vendor is GasPack Technologies, phone +91, "refiller", "godown"). It answers one question: **where is every cylinder right now?** (in our godown/shop, with a customer, or at the refilling plant).

Core idea: **stock is never edited directly. It is derived from bills.** Staff enter an opening count once, then enter paper bills (dispatches, returns, refiller movements, transfers). Every stock figure, balance and report is computed from the posted bills. Late entries land on the correct historical day, and cancelling a bill reverses its effect.

Two surfaces:
1. **Marketing site** (gaspack.in): one-page, "Book a free demo".
2. **Multi-tenant web app** (per-agency subdomain, e.g. `demogas.gaspack.in`, sign-in at `login.gaspack.in`): dashboard, bills, parties, reports, offline backup.

---

## 2. Tech stack observed in the original (for reference only; your stack is in section 10)

| Layer | What the demo uses | Evidence |
|---|---|---|
| Rendering | Server-rendered HTML pages (no SPA) | Full page navigations, no React/Vue/Alpine globals |
| Backend | Very likely **Django** **(inferred)** | `csrfmiddlewaretoken` field, formset field names `lines-0-gas_type`, `lines_total`, `/static/favicon.svg`, UUID primary keys in URLs |
| Interactivity | **HTMX 1.9.12** from unpkg | Script tag; `hx-get`, `hx-trigger`, `hx-target` attributes on the bill form |
| Styling | **Tailwind CSS via CDN** (`cdn.tailwindcss.com/?plugins=forms,typography`) with an inline `tailwind.config` | Script tag. For production, compile Tailwind instead of using the CDN |
| Font | **Inter** (400/500/600/700) from Google Fonts | Stylesheet link |
| Charts | **Chart.js 4.4.3** + **chartjs-plugin-datalabels 2.2.0** from jsDelivr, drawn on `<canvas>` | Insights page scripts |
| Hosting/CDN | **Cloudflare** (email obfuscation `/cdn-cgi/`, Cloudflare Insights beacon) | Page source |
| Icons | Inline SVG | `<svg>` inside links and buttons |
| PWA/offline | No service worker. Offline is a **downloadable static HTML backup file** | `/app/backup/` returns a ~330 KB self-contained HTML page |
| Auth | Session login, email or username plus password, "Forgot your password? Ask your firm's admin to reset it" | Login page |

Small custom JS only: an HTMX progress bar, a toast, closing `<details>` menus on outside click/Escape, a "show 50 more / show all" list limiter, and a custom date-range picker.

---

## 3. Design system

Everything is Tailwind utility classes. Reproduce with this config:

```js
tailwind.config = {
  theme: { extend: {
    colors: { brand: {
      50:'#eff5ff', 100:'#dbe8fe', 200:'#bfd7fe', 300:'#93bbfd', 400:'#6098fa',
      500:'#2563eb', 600:'#1d4ed8', 700:'#1e40af', 800:'#1e3a8a', 900:'#172554' } },
    fontFamily: {
      sans: ['Inter','ui-sans-serif','system-ui','-apple-system','Segoe UI','Roboto','sans-serif'],
      mono: ['ui-monospace','SFMono-Regular','Menlo','monospace'] },
    boxShadow: { card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)' },
  } } }
```

**Page shell**
- `<body class="min-h-screen bg-slate-50 text-slate-900 font-sans">` (page background `#f8fafc`, text `#0f172a`).
- A thin HTMX progress bar element at the very top (`#htmx-progress`).
- Demo banner: `bg-brand-600 text-white text-sm` with a "Get this for your agency →" link (only on the demo).
- Nav: `bg-white border-b border-slate-200 sticky top-0 z-30`, inner `max-w-6xl mx-auto px-4 h-14`. Logo tile is a rounded `bg-brand-600` square with a white cylinder icon, then the agency name. Active tab: `bg-brand-50 text-brand-700 font-medium rounded-md`. Inactive: `text-slate-600 hover:bg-slate-100`.
- Reports is a `<details class="js-menu">` dropdown (white card, `shadow-lg`, `rounded-lg`). On mobile (`md:hidden`) the whole nav collapses into a hamburger `<details>` panel with group labels "Operational" and "Reporting" (`text-[11px] uppercase tracking-wide text-slate-400`).
- Content: `<main class="max-w-6xl mx-auto px-4 py-6">`, sections separated with `space-y-8`.

**Type**
- Page title `text-2xl font-semibold`; subtitle `text-sm text-slate-500`.
- Section label: `text-xs font-semibold uppercase tracking-wide text-slate-400`.
- Big KPI numbers: `text-4xl font-semibold tabular-nums` (hero number `text-6xl font-bold tracking-tight`). Always `tabular-nums`.

**Cards and chips**
- Card: `bg-white border border-slate-200 rounded-xl p-5`, hover `border-brand-300 shadow-card`.
- Hero card ("Sold today"): `border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white`, pulsing green dot, green delta pill (`bg-emerald-100 text-emerald-800 rounded-full text-xs`), a 7-day mini bar chart built from plain `div`s (last bar solid `emerald-600`, the rest `emerald-200`), and a month-to-date progress bar compared with the same point last month.
- Warning card ("Counts below zero"): `border-rose-200 bg-rose-50/40`, number in `text-rose-700`.
- Gas chips: `rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs` with a bold count.
- Grids: `grid grid-cols-2 lg:grid-cols-4` and `lg:grid-cols-5` with `gap-4`; hero cards span 2 columns.

**Colour semantics:** blue = primary action and navigation, green = sales/positive/filled, red = negative or problem counts, amber for "defective" and notices, slate for everything else. Document-type badges are small coloured pills (Dispatch = green, Return from customer = blue, Return from refiller = purple).

**Forms:** Tailwind forms plugin styling. Labels above fields, a red `*` for required, grey placeholder text, helper text under fields, a "+ New" link beside searchable party pickers, submit row at the bottom (Cancel link, secondary "Save draft", primary blue "Post bill").

**Tables:** white card, uppercase `text-xs` grey headers, thin row dividers, status as small tags (green "Posted"), numbers right-aligned. Negative stock is shown in a red tinted cell. Long lists use the 50-row "Show 50 more / Show all" limiter.

**Login page:** two columns. Left: pale blue gradient, small mono label "CYLINDER LEDGER", headline "Every cylinder, accounted for.", a studio photo of six coloured cylinders, "Powered by GasPack Counts". Right: firm name, "Sign in to continue.", email/username and password (with show/hide eye), blue Sign in button, "Sign in to a different firm" link.

**Marketing site:** same blue/slate palette. Sticky top bar (How it works, Book a demo, Sign in). Hero headline "Know where every cylinder is." with two buttons and a floating "Stock at a glance" product card (live-style numbers by gas and an alert about an overdue cylinder). Then a 3x2 feature-card grid, a 3-step "How it works" (01/02/03), benefit checklist, and a contact block with a mailto, phone and "Kushagra Agarwal · GasPack Technologies".

---

## 4. Sitemap and routes

```
/                                   Dashboard
/app/bills/                         Bill list (filters: serial, kind, type, status, party, from/to)
/app/bills/new/                     New bill (shop implied; no internal transfers)
/app/bills/<uuid>/                  Bill detail (+ "Correct this bill", cancel modal, revision history)
/app/bills/<uuid>/revisions/<n>/    View an older version
/app/bills/opening-balance/new/     Opening stock entry (not a paper bill)
/app/returns/new/                   NEW: "Receive empties", returns mapped to dispatch bills (section 0, Change A)
/app/returns/pending/               NEW: list of dispatch bills with pending returns (days out)
/app/parties/                       Party list (summary cards + table)
/app/parties/new/                   Add party
/app/parties/<uuid>/                Party detail
/app/parties/<uuid>/edit/           Edit party
/app/vehicles/                      Vehicle list / add
/app/reports/insights/              Charts and trend cards (6 / 12 / 24 months)
/app/reports/insights/explore/      Pivot builder (metric x split x grain x window)
/app/reports/insights/detail/       Drill-down for a metric/gas/date range
/app/reports/stock/                 Stock grid for a date
/app/reports/ledger/                Day ledger for the shop on one date
/app/reports/party-balance/         Balance register for a date
/app/reports/holdings/              Stock card for one party (CSV + print)
/app/backup/                        One-file offline backup (HTML)
/api/bills/check-serial            Live duplicate bill-serial check (API in your build)
/login/                             Sign in
```

Settings is a menu in the top right (the demo has no standalone settings page).

---

## 5. Domain model (reconstructed)

All primary keys are UUIDs. Every table carries a tenant/firm key.

- **Firm (tenant):** name (single firm unless you later go multi-agency).
- **Staff:** one row per Clerk user (`clerk_user_id`, name, email, optional admin flag). Passwords and sign-in live in Clerk (section 10.1).
- **Party:** `type` in {shop, customer, refiller, supplier} (exactly one shop; see Change B), `name`, `abbreviation` (short code for auto-generated bill numbers, derived from the name if blank), `mobile`, `contact_person`, `address`, `notes`, `active`. Warehouses and shops are the agency's **own locations**; customers, refillers and suppliers are external.
- **Vehicle:** plate, label, active, updated.
- **GasType:** the demo has 10: Medical oxygen, Industrial oxygen, Carbon dioxide, Ammonia, Nitrogen, Argon, DA (dissolved acetylene), Air, Hydrogen, Nitrous oxide. Slugs like `medical_oxygen`. Oxygen grades share a "family" for rollups ("Gas family" split in Insights). Make this configurable per firm.
- **Bill:**
  - `type` in {`dispatch_to_customer`, `return_from_customer`, `send_to_refiller`, `return_from_refiller`} (no internal transfer; see Change B)
  - `paper_kind` in {`bill`, `cash_memo`}
  - `bill_serial` (required, checked for duplicates live per kind), `bill_date` (the business date, may be in the past), `from_party`, `to_party`, optional `vehicle`, `notes`
  - `status` in {draft, posted, cancelled}; entered-by/at, posted-by/at; cancellation reason (Data entry error, Duplicate entry, Customer rejected, Wrong cylinder loaded, Bill voided, Other) plus notes
  - Opening stock is a special bill variant (not a paper bill) that sets a party's starting count on the start date.
- **ReturnAllocation (new, Change A):** links a return bill line to the dispatch bill line it settles, with a quantity. Pending on a dispatch line = dispatched minus allocated.
- **BillLine** (formset): `gas_type`, `fill_state` in {filled, empty, defective}, `quantity` (integer), optional notes. A bill can have many lines. Totals shown: Filled, Empty, Total.
- **BillRevision:** every correction creates a new revision; the bill page lists "Revision 1 (Current)" with "View this version". "Edited" badge appears once corrected.

Counting is **by quantity, not by serial number** in the demo screens. The marketing site claims per-cylinder numbers and history; if you want that, add a `Cylinder` table and a `BillLine -> cylinders` link (see section 9).

---

## 6. Business rules to implement

1. **Stock is derived.** Balance(party, gas, fill_state, date) = opening count + sum of posted bill lines in minus out, up to that date. No manual stock edits.
2. **Movement per type.** (Updated per section 0: one shop only.) Dispatch: shop -> customer. Return from customer: customer -> shop (usually empties). Send to refiller: shop -> refiller (empties out). Return from refiller: refiller -> shop (filled in). No internal transfers.
3. **Posting vs draft.** Drafts have no stock effect; "Post bill" applies it. Drafts can be saved and completed later.
4. **Back-dating.** A bill posts into its `bill_date`, even if entered days later. All dated reports recompute.
5. **Correction.** "Correct this bill" edits create a new revision, and the effect on stock is recomputed. Keep history.
6. **Cancellation.** Permanent, requires a reason, keeps the bill in history, and reverses its stock effect if it was posted.
7. **Customer holding.** "Holds now" = sent minus returned, regardless of fill state. "Oldest unreturned" is computed **first out, first back** by count and shown in days (e.g. "142 days"). This powers the "forgotten cylinders" feature.
8. **Negative counts are allowed but flagged.** Entering bills in the wrong order or with missing opening stock yields negative balances. The dashboard shows "Counts below zero: N (X at your locations, Y with parties)" in red, and the stock grid shows negatives in red cells.
9. **Duplicate serial check.** a debounced call to the check-serial endpoint fires on keyup (300 ms delay), blur and paper-kind change.
10. **Party pickers** are searchable selects with an inline "+ New" to create a party without leaving the bill.
11. **Form re-render on type change.** Changing the Type select does `hx-get` on `/app/bills/new/` and swaps `#bill-form` (so From/To lists filter to sensible party types). Changing From/To also re-fetches.
12. **Roles.** Staff sign in; an operator/admin section covers vehicles, backup, and settings.

---

## 7. Page specs

**Dashboard.** Title "Welcome, <name>" and "Here's where things stand today."
- *Today:* hero "Sold today" (count, delta vs the same weekday last week, customers count, per-gas chips, 7-day bar strip, month-to-date vs last month's same day with a progress bar); "Received from customers" (count, gas breakdown, **net out today** = dispatched - returned with a plain-English line); "Bills today" (count, last bill time); "Counts below zero" (red). A line for refiller: "11 sent for refill, 14 received back".
- *Your cylinders:* Total cylinders with gas chips; In your stock (filled/empty/defective split plus top gases); With customers (count of customers, per gas); At refiller (count of refillers, per gas, can be negative).
- *Quick actions:* big blue "New bill" tile, then tiles for Bills, Stock, Parties, Day ledger, Balance register, Opening stock.
- Each tile is a link to the relevant filtered page (e.g. `/app/bills/?type=dispatch_to_customer`).

**Bills list.** Filters: serial contains, kind, type, status (Active = drafts + posted), party name, from/to date, Reset. Header buttons: "Opening balance", "+ New bill". Columns: Serial, Date, Type (badge), From -> To, Lines, Status. Shows total count ("2283 bills").

**New bill.** Fields in order: Type*, Paper kind*, Bill serial*, Bill date* (dd/mm/yyyy picker plus the weekday spelled out beneath), From*, To* (searchable, "+ New"), Vehicle (optional), Notes. Then a **LINES** card: each row = gas select + Filled/Empty segmented toggle + quantity + remove (x); "+ Add line", "+ Add a gas" (adds a row per gas); footer totals Filled / Empty / Total. Buttons: Cancel, Save draft, Post bill.

**Bill detail.** Title is the serial with an "Edited" badge, subtitle "Type · date". Actions: Correct this bill, Cancel. Panels: Status (entered/posted by whom and when), From -> To, Vehicle/notes, Lines table, "+ New bill", Revision history, and a "Cancel bill" danger section with a reason dropdown and notes (modal confirm).

**Parties.** Summary cards: Active parties (breakdown by type), With customers, At refillers, Below zero. Filters: name, type, show inactive. Table: Name (link), Type, Holding now, Last bill, View/Edit.

**Party detail.** Name and type tag; actions Stock card / Edit / Opening stock. "Holds now" table per gas with the oldest unreturned age. "This month" Sent/Returned/Net out. Bills tab and "Daily summary" tab, plus a custom date-range picker and a bills filter (active / cancelled / all).

**Add party.** Type (Customer, Refiller, Supplier; the single Shop is created at setup), Name*, Abbreviation, Mobile, Contact person, Address, Notes, Active. Buttons Cancel / Create.

**Opening stock.** Party* (with type in brackets), start date, then gas/fill/quantity lines. Explanation: do one for the shop, then one per customer already holding cylinders. Lists existing opening entries below.

**Insights.** Toggle 6/12/24 months. Four trend cards (Dispatched this month, Returned, Net out, Active customers) each with a % delta vs last month (the current month is partial and labelled so). Stacked monthly bar chart by gas (Chart.js with data labels, total on top of each bar), with a legend and a data table below. "Explore" opens a pivot builder: Metric (Dispatched, Returned, Net out, Sent to refillers, Received from refillers, Active customers, New customers) x Split by (Nothing, Gas, Gas family, Location, Customer) x Grain (Weekly/Monthly/Quarterly) x Window (6/12/24 months). Output: a table of periods with delta and window total; every number links to a drill-down list of the underlying bills.

**Stock.** Date picker, "Apply", month-end shortcut chips, prev/next day. Grid: rows = gases, column group = the Shop (Filled / Empty / Defective), With customers, At refiller, Total. Negatives red.

**Day ledger.** Date only (always the shop). Two tables (Filled, Empty, and Defective if used): rows Opening / In / Out / Closing, columns = gases + Total.

**Party balance register.** Date, party type, balance filter (non-zero/all), name search. Table: Party, Type, Breakdown ("Industrial oxygen 27, Nitrogen 2..."), Balance. Rows expand to a per-gas breakdown. Header text: "79 parties, holding 189, 30 below zero".

**Stock card.** One party and a date range (defaults to the current financial year starting 1 April). A statement view: columns per gas with **D**ispatched / **R**eceived back / **B**alance, opening balance row, one row per month that expands into its bills with links. Buttons: Download CSV, Print, "Full history".

**Backup.** `/app/backup/` returns one self-contained HTML file (~330 KB): inline CSS and no external dependencies, containing every party's current stock and the last 60 days of bills. Intended to be saved each evening so staff can read it with no internet. It has a yellow "note" banner. Link text on the menu: "One file with every party's stock and the last 60 days of bills. Opens with no internet."

---

## 8. Demo-specific behaviour (optional to copy)

- A separate demo tenant with fake data (94 parties, 2,283 bills, ~550 cylinders), reset nightly. A blue banner explains it, and write attempts to "closed" pages show a toast via the `publicDemoNotice` HTMX event.
- Sample data deliberately includes some negative counts.

---

## 9. Gaps and suggested improvements for your version

- The marketing site promises **per-cylinder numbers and history, and lost-cylinder alerts**, but the demo screens only count by gas. Decide whether to build true serialised cylinders (a `Cylinder` table, scan/typed serial on each line, status and location history, "days out" alerts) or keep count-based and soften the claim.
- Demo data has many negative balances; seed yours cleanly so the dashboard "below zero" card starts at 0.
- Replace Tailwind CDN with a compiled build, pin and self-host HTMX/Chart.js.
- Add per-firm gas configuration, user roles, audit log (the revision history is a start), GST/invoice amounts if you need billing (the demo tracks cylinders only, no prices).
- Pricing is not published; the sales flow is "Book a free demo" by phone/email.

---

## 10. Your stack: Next.js + Node.js API + PostgreSQL

This replaces the Django/HTMX stack the original uses. The original behaviour is unchanged; only the technology differs.

### 10.1 Architecture

- **Monorepo** (pnpm workspaces or Turborepo):
  - `apps/web`: **Next.js (App Router, TypeScript)** + Tailwind CSS (compiled, not the CDN) + shadcn/ui or Radix for menus/dialogs.
  - `apps/api`: **Node.js REST API** in TypeScript. Recommended: **Fastify** (small, fast, good schema validation). NestJS is fine if you prefer a structured framework.
  - `packages/shared`: **Zod** schemas and TypeScript types shared by both apps (bill form, return form, party form) so validation is written once.
- **Database:** PostgreSQL. ORM: **Prisma** (or Drizzle) for normal CRUD, with **raw SQL** for the stock and report queries (they are aggregates, easier to write and tune in SQL).
- If you would rather have one deployable, Next.js route handlers can host the API instead of a separate Fastify app. The rest of this section applies either way. Keep business logic in a `services/` layer, not in route files.
- **Auth: Clerk.** Staff-only app (the client's staff who manage inventory), so there is **no public sign-up and no customer login**.
  - **Web:** `@clerk/nextjs`. Wrap the app in `<ClerkProvider>`, protect routes with `clerkMiddleware()` in `middleware.ts` (everything except `/sign-in` is private), and use Clerk's `<SignIn />` on `/sign-in`. Style it with Clerk's `appearance` prop (brand blue `#2563eb`, Inter, rounded card) and put it in the split-screen layout from section 3 (cylinder photo on the left, "Every cylinder, accounted for."). Use `<UserButton />` in the top-right menu in place of the original's Settings dropdown (sign out, account).
  - **Closed to the public:** in the Clerk dashboard set sign-up to **restricted / invitation-only** (or disable sign-ups) so only people the owner invites can get in. The owner invites each staff member from the Clerk dashboard (or from a small in-app "Staff" screen using Clerk's Invitations API). Remove a person's access by deactivating or deleting their Clerk user.
  - **API:** the Next.js app sends the Clerk session token as a bearer token to the Node API. The API verifies it on every request with `@clerk/backend` (`authenticateRequest`/`verifyToken`) or the `@clerk/fastify` plugin, then loads the staff record. Reject anything unauthenticated with 401. Never trust a user id sent in the request body.
  - **Roles:** since every user is staff, start with one role. If the owner wants some staff to manage other staff, add a single `admin` flag in Clerk `publicMetadata` (`{ "role": "admin" }`) and check it in the API for the Staff screen and any destructive actions.
  - **Passwords and recovery:** Clerk handles password hashing, "forgot password" by email, and optional email-code or two-factor sign-in. This replaces the original's "ask your firm's admin to reset it" flow. Decide in Clerk settings whether staff sign in with email + password or an emailed code (an emailed code suits shared shop computers poorly; password is usually better there).
  - **Local `staff` table:** keep a row per Clerk user so bills can record who entered/posted them (`entered_by`, `posted_by`). Create it lazily on a user's first API request (upsert by `clerk_user_id`), or sync with Clerk webhooks (`user.created`, `user.updated`, `user.deleted`). Store the display name so old bills still show it after a Clerk user is removed.
- **Multi-tenant (only if you later sell it to several agencies):** a `firm_id` column on every table; map each agency to a **Clerk Organization** and read the active `orgId` from the session token in the API to pick the firm. If it is only for your one client (the current plan), keep a single firm and skip Organizations and subdomains.
- **Hosting:** Vercel or a VPS for Next.js, Railway/Render/Fly/VPS for the API, Neon/Supabase/RDS for Postgres. Cloudflare in front is optional.

### 10.2 How the original's HTMX behaviours map to Next.js

| Original (HTMX/Django) | Your version |
|---|---|
| Form re-render when Type or party changes | React state in the bill form (no server round trip needed) |
| Live duplicate bill-serial check (`/check-serial/`) | Debounced (300 ms) `GET /api/bills/check-serial` via TanStack Query or SWR |
| Searchable party select with "+ New" | Combobox component (shadcn `Command`), "+ New" opens a dialog that `POST`s a party |
| Bill line formset (`lines-0-...`) | `react-hook-form` `useFieldArray` + Zod validation |
| 50-row "Show more" limiter | Server pagination / cursor (the demo has 2,283 bills; do not load them all) |
| Top progress bar | `nextjs-toploader` |
| Toasts (including Undo) | `sonner` |
| Custom date-range picker | `react-day-picker` |
| Chart.js charts | `react-chartjs-2` (same look) or Recharts |
| Server-rendered pages | Server Components fetching from the API, with client components only for forms |
| Offline backup HTML | `GET /api/backup` returns a generated self-contained HTML file (inline CSS, no JS dependencies) as a download |
| CSV export (stock card) | `GET /api/reports/holdings.csv` |

### 10.3 PostgreSQL schema (core tables)

```sql
CREATE TYPE party_type  AS ENUM ('shop','customer','refiller','supplier');
CREATE TYPE bill_type   AS ENUM ('dispatch_to_customer','return_from_customer','send_to_refiller','return_from_refiller');
CREATE TYPE paper_kind  AS ENUM ('bill','cash_memo','quick_entry','opening');
CREATE TYPE bill_status AS ENUM ('draft','posted','cancelled');
CREATE TYPE fill_state  AS ENUM ('filled','empty','defective');

CREATE TABLE firms   (id uuid PRIMARY KEY, name text NOT NULL, subdomain text UNIQUE, created_at timestamptz DEFAULT now());
CREATE TABLE staff   (id uuid PRIMARY KEY, firm_id uuid REFERENCES firms, clerk_user_id text UNIQUE NOT NULL,
                      name text, email text, is_admin boolean DEFAULT false, active boolean DEFAULT true);  -- passwords live in Clerk, not here
CREATE TABLE parties (id uuid PRIMARY KEY, firm_id uuid REFERENCES firms, type party_type NOT NULL, name text NOT NULL,
                      abbreviation text, mobile text, contact_person text, address text, notes text, active boolean DEFAULT true);
-- exactly one shop per firm:
CREATE UNIQUE INDEX one_shop_per_firm ON parties (firm_id) WHERE type = 'shop';

CREATE TABLE gas_types (id uuid PRIMARY KEY, firm_id uuid REFERENCES firms, slug text, name text, family text, sort int, active boolean DEFAULT true);
CREATE TABLE vehicles  (id uuid PRIMARY KEY, firm_id uuid REFERENCES firms, plate text, label text, active boolean DEFAULT true);

CREATE TABLE bills (
  id uuid PRIMARY KEY, firm_id uuid REFERENCES firms,
  type bill_type NOT NULL, paper_kind paper_kind NOT NULL DEFAULT 'bill',
  serial text NOT NULL, bill_date date NOT NULL,
  from_party_id uuid REFERENCES parties, to_party_id uuid REFERENCES parties,
  vehicle text, notes text,
  status bill_status NOT NULL DEFAULT 'draft',
  entered_by uuid REFERENCES staff, entered_at timestamptz DEFAULT now(),
  posted_by uuid REFERENCES staff,  posted_at timestamptz,
  cancel_reason text, cancel_notes text, cancelled_by uuid REFERENCES staff, cancelled_at timestamptz,
  current_revision int NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX bills_serial_unique ON bills (firm_id, paper_kind, serial) WHERE status <> 'cancelled';

CREATE TABLE bill_lines (
  id uuid PRIMARY KEY, bill_id uuid REFERENCES bills ON DELETE CASCADE,
  line_no int, gas_type_id uuid REFERENCES gas_types, fill_state fill_state NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0), notes text
);

CREATE TABLE bill_revisions (id uuid PRIMARY KEY, bill_id uuid REFERENCES bills, revision int, snapshot jsonb,
                             changed_by uuid REFERENCES staff, changed_at timestamptz DEFAULT now(), UNIQUE (bill_id, revision));

-- Change A: ties returned empties to the dispatch line they settle
CREATE TABLE return_allocations (
  id uuid PRIMARY KEY,
  return_line_id   uuid NOT NULL REFERENCES bill_lines,
  dispatch_line_id uuid NOT NULL REFERENCES bill_lines,
  quantity int NOT NULL CHECK (quantity > 0)
);
CREATE INDEX ON return_allocations (dispatch_line_id);

CREATE TABLE serial_counters (firm_id uuid, prefix text, day date, last int, PRIMARY KEY (firm_id, prefix, day));  -- RET-20261126-001
```

Opening stock is a `bills` row with `paper_kind = 'opening'` (a pseudo dispatch to the party), so it appears in "Receive empties" as the "OPENING" row and works with allocations like any other dispatch.

### 10.4 The two queries everything depends on

**Stock/balance of every party, gas and fill state as of a date** (posted bills only; a party gains when it is `to`, loses when it is `from`):

```sql
WITH moves AS (
  SELECT b.to_party_id   AS party_id,  l.gas_type_id, l.fill_state,  l.quantity AS qty
    FROM bills b JOIN bill_lines l ON l.bill_id = b.id
   WHERE b.firm_id = $1 AND b.status = 'posted' AND b.bill_date <= $2
  UNION ALL
  SELECT b.from_party_id AS party_id,  l.gas_type_id, l.fill_state, -l.quantity AS qty
    FROM bills b JOIN bill_lines l ON l.bill_id = b.id
   WHERE b.firm_id = $1 AND b.status = 'posted' AND b.bill_date <= $2
)
SELECT party_id, gas_type_id, fill_state, SUM(qty) AS balance
  FROM moves GROUP BY 1,2,3;
```

Note: a return of empties changes the customer's balance in the "empty" column only if you track empties at the customer. For "cylinders held by customer" (the original's definition: sent minus returned, any fill state), sum quantity ignoring `fill_state` for customers. Decide this once and test it against the demo's numbers.

**Pending returns per dispatch line** (Change A):

```sql
SELECT dl.id AS dispatch_line_id, b.serial, b.bill_date, dl.gas_type_id, dl.quantity AS sent,
       COALESCE(SUM(a.quantity) FILTER (WHERE rb.status = 'posted'), 0) AS returned,
       dl.quantity - COALESCE(SUM(a.quantity) FILTER (WHERE rb.status = 'posted'), 0) AS pending
  FROM bills b
  JOIN bill_lines dl ON dl.bill_id = b.id
  LEFT JOIN return_allocations a ON a.dispatch_line_id = dl.id
  LEFT JOIN bill_lines rl ON rl.id = a.return_line_id
  LEFT JOIN bills rb ON rb.id = rl.bill_id
 WHERE b.firm_id = $1 AND b.type = 'dispatch_to_customer' AND b.status = 'posted' AND b.to_party_id = $2
 GROUP BY dl.id, b.serial, b.bill_date
HAVING dl.quantity - COALESCE(SUM(a.quantity) FILTER (WHERE rb.status = 'posted'), 0) > 0
 ORDER BY b.bill_date, b.serial;
```

### 10.5 API endpoints (REST)

```
GET    /api/me                                   current staff member (from the Clerk token)
GET    /api/staff   POST /api/staff/invite       admin only; wraps Clerk invitations (optional screen)
GET    /api/dashboard                            KPIs, pending returns, below-zero count
GET    /api/parties            POST /api/parties        GET/PATCH /api/parties/:id
GET    /api/vehicles           POST /api/vehicles
GET    /api/bills?filters      POST /api/bills (draft or post)     GET/PATCH /api/bills/:id
POST   /api/bills/:id/post     POST /api/bills/:id/cancel          GET /api/bills/:id/revisions/:n
GET    /api/bills/check-serial?serial=&kind=
POST   /api/opening-stock
GET    /api/customers/:id/pending-returns        open dispatch lines (query above)
POST   /api/returns                              body: { customerId, date, items:[{dispatchLineId, quantity, fillState}], extras:[...] }
GET    /api/reports/{stock,ledger,party-balance,holdings,insights,explore,detail}
GET    /api/reports/holdings.csv                 GET /api/backup
```

### 10.6 Implementation rules that matter

- **Post and return in one DB transaction.** `POST /api/returns` must, inside a transaction: lock the dispatch lines (`SELECT ... FOR UPDATE`), re-check pending >= requested quantity, create the return bill (generated serial from `serial_counters`, with `INSERT ... ON CONFLICT DO UPDATE` to increment safely), insert its lines, insert `return_allocations`, and mark the bill `posted`. If any check fails, roll back everything. This prevents two staff members over-returning the same bill at the same moment.
- **Never edit stock directly.** Stock is only ever the aggregate query above over posted bills.
- **Cancel = status change, not delete.** A cancelled return's allocations stop counting because the query filters on `rb.status = 'posted'`.
- **Corrections** write a `bill_revisions` snapshot, replace the live `bill_lines`, and re-validate (a dispatch line's quantity cannot drop below what has been returned).
- **Validate with the shared Zod schemas on both client and server.** Treat the server as the authority.
- **Index** `bills (firm_id, bill_date)`, `bills (to_party_id)`, `bills (from_party_id)`, `bill_lines (bill_id)`, and `return_allocations (dispatch_line_id)`.
- **Performance:** the aggregate is fast at this scale (thousands of bills). Only add a daily snapshot table if reports get slow.
- **Testing:** unit-test the two queries against a small fixed dataset (opening stock, dispatch 5, return 3, cancel the return, back-dated bill) and assert the numbers; this is where most bugs will be.

---

## 11. Suggested build order (for your stack)

1. Monorepo scaffold: Next.js + Tailwind (compiled) + Fastify API + Prisma + Postgres (Docker Compose for local dev), shared Zod package, lint/format, CI.
2. Auth with Clerk: create the Clerk application, switch sign-up to invitation-only, add `clerkMiddleware`, the styled `/sign-in` page (split-screen design from section 3), token verification in the API, and the lazy `staff` upsert. Seed one firm, the shop party and gas types; invite the owner as the first admin.
3. Parties, gas types, vehicles: CRUD screens and endpoints.
4. Bills: schema, bill form with line array, draft/post/cancel, revisions, duplicate-serial check, shop implied as From/To (Change B).
5. Stock engine: the aggregate query, wrapped in a service with tests.
6. **Receive empties (Change A):** pending-returns query, allocation table, `POST /api/returns` transaction, the screen, the returns panel on dispatch bills, undo.
7. Dashboard: KPI cards, Pending returns card, quick actions.
8. Reports: Stock, Day ledger, Party balance, Stock card (+CSV, print), then Insights and Explore with drill-down.
9. Offline backup export.
10. Marketing site page (or a separate simple Next.js route group) and demo tenant with nightly reset.
11. Polish: mobile nav, pagination, toasts, accessibility, error handling, backups of the database.
