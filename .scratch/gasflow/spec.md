# GasFlow: first release

Status: ready-for-agent
Date: 26 November 2026

**Precedence:** this spec overrides the build blueprint wherever they conflict. The blueprint still applies to anything not covered here, including the visual design system, page layouts, report layouts and route structure. The project glossary defines the domain terms used below. Two decision records explain why cylinders are counted without individual identity and why there is no tenancy.

## Problem Statement

A gas agency needs to know where every cylinder is: at the shop, with a customer, or at a refiller. Its staff work from paper bills. A running total per customer does not tell them which dispatch bill the returned empties belong to, so nobody can see that a bill sent 5, 3 came back and 2 are still out, or how long those 2 have been out.

Stock figures also drift from reality when cylinders are bought, scrapped or lost, or when typing mistakes can silently change what the records say.

## Solution

GasFlow is a staff-only web app for one agency with one shop. Staff record bills; every stock figure, holding and report is calculated from those bills, and stock is never edited directly.

Returns are recorded on a single screen, Receive empties: staff pick the customer, type how many came back against each dispatch bill with pending cylinders, and save. Every dispatch bill then shows what has been returned, what is pending and how many days out it is, and overdue cylinders stand out. Cylinders joining or leaving the business are recorded as their own bills, and the app refuses changes that would contradict returns already recorded.

## User Stories

### Signing in and staff accounts

1. As a staff member, I want to sign in with a username and password, so that I can use the app without needing an email address.
2. As a staff member, I want to show or hide my password while typing it, so that I can avoid mistakes at a shared counter.
3. As a staff member, I want to sign out from the top menu, so that the next person on a shared computer does not act under my name.
4. As an admin, I want public sign-up to be disabled, so that only people the agency has added can get in.
5. As an admin, I want to create a staff account with a name, username and starting password, so that a new employee can start the same day.
6. As an admin, I want to reset a staff member's forgotten password, so that they can get back to work without an email.
7. As an admin, I want a recovery email on my own account, so that a forgotten admin password does not lock the agency out.
8. As an admin, I want to remove a staff member's access, so that former employees cannot sign in.
9. As an admin, I want bills to keep showing who entered them after that person is removed, so that the history stays readable.
10. As an admin, I want to choose which staff members are admins, so that sensitive actions are limited to trusted people.

### Setup, parties, gases and vehicles

11. As an admin, I want the shop and the start date set during setup, so that records begin from a known point.
12. As an admin, I want the starting list of gases already in place, so that I can begin entering bills quickly.
13. As an admin, I want to add, rename and retire gases, so that the list matches what the agency handles.
14. As a staff member, I want to add and edit customers, refillers and suppliers with their contact details, so that bills can name them.
15. As a staff member, I want to add a new party from within a bill's party picker, so that I do not lose the bill I am entering.
16. As a staff member, I want to search parties by name, so that I can find one quickly in a long list.
17. As a staff member, I want to deactivate a party that is no longer used, so that pickers stay short.
18. As a staff member, I want to be stopped from deactivating a party that still holds cylinders or has unmatched returns, so that open matters are not hidden.
19. As a staff member, I want to add and manage vehicles, so that a bill can record which one carried the cylinders.

### Opening stock

20. As an admin, I want to enter the shop's opening stock by gas and fill state, so that shop counts are right from the start date.
21. As an admin, I want to enter each customer's and refiller's opening stock, so that holdings include cylinders already out.
22. As an admin, I want opening stock found later to be dated the start date, so that all history stays consistent.
23. As an admin, I want to be stopped from entering a second opening stock for a party, so that cylinders are not counted twice.
24. As an admin, I want to correct a wrong opening stock count, so that a counting mistake can be fixed.
25. As a staff member, I want to be stopped from entering a bill dated before the start date, so that cylinders in the opening counts are not counted again.

### Entering bills

26. As a staff member, I want to enter a dispatch bill with its paper kind, bill number, date, customer, vehicle, notes and gas lines, so that cylinders leaving the shop are recorded.
27. As a staff member, I want to enter a send to refiller bill, so that empties at the refiller are tracked.
28. As a staff member, I want to enter a return from refiller under the refiller's slip number, so that filled cylinders coming back are recorded.
29. As a staff member, I want to pick only the customer or refiller, so that I never have to choose the shop.
30. As a staff member, I want to add several gas lines, choose each fill state and see running totals, so that I can check the bill against the paper.
31. As a staff member, I want to be warned as I type that a bill number is already in use, so that I catch duplicates before saving.
32. As a staff member, I want a cancelled bill's number to become available again, so that I can re-enter the paper bill correctly.
33. As a staff member, I want to enter a bill with a past date, so that late paperwork counts on the correct day.
34. As a staff member, I want saving a bill to update stock immediately, so that there is no second step to forget.
35. As an admin, I want to record cylinders added to the business, optionally naming the supplier, so that new cylinders appear in stock.
36. As an admin, I want to write off scrapped or lost cylinders from the shop or a refiller with a reason, so that counts match reality.
37. As an admin, I want to write off a customer's lost cylinders against a chosen dispatch bill or opening stock, so that they stop showing as pending.

### Receive empties

38. As a staff member, I want the customer picker focused when the screen opens and showing each customer's total pending, so that I can start typing at once.
39. As a staff member, I want to open Receive empties from a customer's page with that customer already chosen, so that I skip a step.
40. As a staff member, I want to see the customer's dispatch bills with pending cylinders, oldest first, one row per bill and gas, with sent, returned, pending and days out, so that I know what to allocate.
41. As a staff member, I want the customer's opening stock listed as "Opening stock", so that cylinders from before the start date can be returned.
42. As a staff member, I want to type the number returning against a row, so that a partial return takes seconds.
43. As a staff member, I want an "All" button on each row, so that I can return everything pending in one tap.
44. As a staff member, I want to enter one total for a gas and have it spread across the oldest eligible bills, then adjust the split, so that large returns are quick.
45. As a staff member, I want the return date to default to today with the option to change it, so that I can record yesterday's returns.
46. As a staff member, I want only bills dated on or before the return date to be offered, so that cylinders cannot come back before they left.
47. As a staff member, I want the fill state to default to Empty and be changeable per row, so that filled or defective cylinders are counted correctly at the shop.
48. As a staff member, I want to note a paper slip number on a return, so that I can find it again.
49. As a staff member, I want to save cylinders in excess of everything pending as an unmatched return, so that shop stock matches what is physically there.
50. As a staff member, I want to be stopped from leaving cylinders unmatched while eligible pending cylinders of that gas remain, so that dispatch bills stay accurate.
51. As a staff member, I want to receive cylinders from a customer who has nothing pending, so that unexpected returns are still recorded.
52. As a staff member, I want to be stopped from returning more against a bill than it has pending, including when a colleague saved first, so that a bill is never over-returned.
53. As a staff member, I want a confirmation naming the customer, quantity and bills, with an Undo for about 10 seconds, so that I can reverse a slip at once.
54. As a staff member, I want to see all unmatched returns in a list, so that they get resolved.
55. As a staff member, I want to match an unmatched return to an eligible bill, so that I can fix it after the missing dispatch bill is entered.

### Correcting and cancelling

56. As a staff member, I want to correct or cancel a bill I entered today, so that I can fix my own typing mistakes.
57. As an admin, I want to correct or cancel any bill, so that older mistakes can be fixed.
58. As a staff member, I want to fix a wrong return by cancelling it and recording it again, so that the pending counts are restored exactly.
59. As an admin, I want to fix a wrong customer write-off the same way, so that allocations stay consistent.
60. As a staff member, I want to give a reason and notes when cancelling, and still see the cancelled bill, so that the history explains what happened.
61. As a staff member, I want to be stopped from cancelling or changing a bill in a way that contradicts its returns or write-offs, with links to the bills in the way, so that I know what to fix first.
62. As an admin, I want to see earlier versions of a corrected bill and an "Edited" mark, so that I can check what changed and who changed it.

### Seeing where cylinders are

63. As a staff member, I want a dispatch bill to show sent, returned, written off and pending, an Open, Partly returned or Closed tag, and each return and write-off with its date, quantity, number and who entered it, so that I can answer a customer's question.
64. As a staff member, I want to filter the bill list by bill number, slip number, paper kind, type, status, party and date range, so that I can find any bill.
65. As a staff member, I want dispatch bills in the list to show how much has been returned and a pending returns filter, so that I can spot open ones.
66. As a staff member, I want a customer's or refiller's page to show what they hold by gas, their bills and this month's movement, so that I have their full picture.
67. As a staff member, I want a customer's page to list pending bills with days out, so that I can ask for the oldest cylinders back.
68. As a staff member, I want a list of all pending returns sorted by days out, so that I can follow up.
69. As a staff member, I want overdue cylinders highlighted wherever pending cylinders are shown, so that they stand out.
70. As an admin, I want to set the overdue limit, starting at 30 days, so that it matches the agency's practice.
71. As a staff member, I want a dashboard showing today's dispatches and returns, bills entered, shop stock, cylinders with customers and at refillers, pending and overdue returns, and counts below zero, so that I see the position at a glance.
72. As a staff member, I want dashboard figures to link to the matching list, so that I can see the bills behind a number.
73. As a staff member, I want a stock report for any date showing the shop by fill state, customers, refillers and the total by gas, so that I can check past positions.
74. As a staff member, I want a day ledger showing the shop's opening, in, out and closing counts, so that I can reconcile the day.
75. As a staff member, I want a balance register of what every party holds on a date, with search and filters, so that I can review all holdings.
76. As a staff member, I want a stock card for one party over a date range, with each return showing the bill it was allocated to, so that I can settle a dispute.
77. As a staff member, I want to download the stock card as CSV and print it, so that I can share it.
78. As a staff member, I want negative counts flagged in red, not blocked, so that I can enter paperwork in any order and still notice problems.
79. As a staff member, I want to download a single offline backup file with every party's holdings and the last 60 days of bills, so that I can look things up without internet.
80. As a staff member, I want the app to be usable on a phone, so that I can record returns away from the counter.

## Implementation Decisions

### Architecture

- Monorepo with a Next.js (App Router, TypeScript, Tailwind) web app, a Fastify API, PostgreSQL through Prisma with raw SQL for reports, and a shared package of Zod schemas used by both apps. The API is the authority on all validation and rules.
- Clerk handles authentication. The API verifies the session token on every request, rejects anything unauthenticated, and never takes a staff identity from the request body.
- Identity provider access (token verification, account creation, password reset, access removal) and the clock each sit behind one replaceable interface in the API.
- Hosting is Vercel for the web app and API and Neon for the database, in the region closest to the shop. Local development uses Postgres in Docker. Database recovery relies on Neon's recovery features. Check current plan pricing; Vercel's free plan does not permit commercial use.
- No tenancy: no firm keys, subdomains or organizations.
- Business logic lives in service modules, not in route handlers.

### The bill ledger

One service module owns every change to bills and allocations: create, correct, cancel, allocate and match. Each operation checks all rules and writes inside a single database transaction. Any operation that creates or removes an allocation, or changes a bill that can have allocations, first locks the customer concerned, so that two staff members cannot act on the same pending cylinders at once. Reports only read.

### Bills

| Bill type | Movement | Bill number | How a mistake is fixed |
|---|---|---|---|
| Dispatch | Shop to customer | Typed, from the agency's paper | Correct or cancel |
| Send to refiller | Shop to refiller | Typed, from the agency's paper | Correct or cancel |
| Return from refiller | Refiller to shop | The refiller's slip number | Correct or cancel |
| Return | Customer to shop | Generated, such as `RET-20261126-001` | Cancel and record again |
| Add cylinders | Into the business, to the shop; supplier optional | Generated | Correct or cancel |
| Write-off | Out of the business, from the shop, a customer or a refiller; reason required | Generated | From a customer: cancel and enter again. Otherwise correct or cancel |
| Opening stock | A party's count on the start date | Generated | Correct or cancel |

- A bill is either posted or cancelled. There are no drafts and no separate posting step.
- Paper kind (bill or cash memo) applies to dispatches and sends to a refiller. Their numbers are unique forever within a paper kind, across both types together. A refiller's slip number is unique for that refiller. Uniqueness is enforced by the database and ignores cancelled bills.
- Generated numbers are issued safely under concurrent saves.
- Cancellation is permanent, needs a reason (data entry error, duplicate entry, customer rejected, wrong cylinder loaded, bill voided or other) with optional notes, and removes the bill's effect from every figure.
- A correction saves the earlier version as a revision. Lines that have allocations keep their identity through a correction.
- No bill may be dated before the start date.
- The customer return type is not offered in the general bill form.
- A return's optional slip number is searchable and need not be unique.

### Allocations, pending and unmatched returns

- An allocation ties a quantity on a return or customer write-off line to a line of the same gas on a dispatch bill or opening stock for the same customer, dated no later than the return or write-off.
- Pending is shown per bill and gas, even when a bill has several lines of that gas. It is sent minus everything allocated by posted returns and write-offs. Cancelling a return or write-off therefore restores it.
- Eligibility depends on the clearing bill's date, but the quantity already used up counts all posted allocations, whatever their dates.
- A return may leave a quantity unmatched only when no eligible pending cylinders of that gas remain after its own allocations. This is checked when the return is saved. Unmatched cylinders may later coexist with pending ones, for instance after a missing dispatch bill is entered, until someone matches them.
- A customer write-off is limited to the chosen bill's pending quantity and is never unmatched.
- Invariant: a customer's holding of a gas equals pending minus unmatched.
- A dispatch bill or customer opening stock cannot be cancelled while it has allocations. A correction cannot change its customer, remove an allocated gas, lower a gas below its allocated quantity, or move its date after an allocated return or write-off. The refusal lists the blocking bills.
- The API calculates the proposed "Fill oldest first" split; the screen displays it and lets staff adjust it.
- Saving Receive empties creates one return bill covering all rows. Undo cancels that bill with the reason data entry error.
- A dispatch bill's tag is Open when nothing is cleared, Partly returned when some is, and Closed when nothing is pending. Closed rows are hidden on Receive empties behind a "Show closed bills" link.

### Stock and reports

- All figures are calculated from posted bills as of a date. Nothing stores an editable stock count.
- Fill state counts only for the shop. Customer and refiller holdings add quantities across fill states.
- The outside side of an add cylinders or write-off bill is not a holder. It, and suppliers, never appear in holdings, totals or counts below zero.
- Total cylinders is the shop plus customers plus refillers.
- Opening stock forms the starting position. It is not counted as movement in the dashboard, day ledger or stock card activity.
- Negative counts are allowed and flagged. No bill is refused because recorded stock is too low.
- Days out runs from the dispatch bill's date, or the start date for opening stock. Pending cylinders are overdue when days out exceed the limit.
- "Today" follows Indian Standard Time.
- Long lists are paginated by the API.
- The offline backup is a self-contained HTML download with no external dependencies.

### People and permissions

- Staff sign in with a username and password. Accounts are created by an admin; there are no email invitations. Admins also have a recovery email.
- A local staff record keeps each person's display name for bill history.
- The admin role is held in Clerk's public metadata and checked by the API.

| Action | Staff | Admin |
|---|---|---|
| Enter dispatches, refiller movements and returns | Yes | Yes |
| Match an unmatched return | Yes | Yes |
| Add or edit customers, refillers, suppliers and vehicles | Yes | Yes |
| View reports and download the backup | Yes | Yes |
| Correct or cancel a posted bill | Only bills they entered today | Any |
| Add cylinders or write off | No | Yes |
| Enter or correct opening stock | No | Yes |
| Set the overdue limit, manage gases and staff | No | Yes |

The permission limits on correcting and cancelling apply on top of the rule that returns and customer write-offs are never corrected.

### Interface

- The shop name is GasFlow. Printouts show the name and logo, with no address.
- Labels use glossary terms: for example "Dispatched today" instead of "Sold today", and "Opening stock" instead of "Opening balance".
- The sign-in screen follows the blueprint's split layout, with GasFlow branding only.
- Dispatches use the full bill form.

## Testing Decisions

- **One automated seam: the API.** Tests send HTTP requests to the Fastify app in process, against a real PostgreSQL database. Screens are checked by hand.
- **Two stand-ins only:** the identity provider and the clock.
- A good test sets up data through the API, performs an action and asserts on what the API reports: figures, lists, files or refusals. It does not inspect tables, call service functions or assert on SQL, so internals can change without rewriting tests.
- The stock and pending calculations are tested through the report and bill endpoints, in place of the separate query tests the blueprint describes. Write these tests before building the screens that depend on them.
- Core fixed scenario: opening stock, dispatch 5, return 3, cancel the return, then a back-dated bill, asserting holdings, shop counts and pending after each step.
- Required coverage:
  - The holding invariant (pending minus unmatched) after every kind of bill, cancellation and matching.
  - Allocation date order, the excess-only rule, matching later and the "Fill oldest first" split.
  - Every refusal protecting allocated bills.
  - Two returns or write-offs against the same bill sent at the same moment, using separate database connections.
  - Number uniqueness for each bill type, and reuse after cancellation.
  - Each permission row, as staff and as admin, including the "entered today" boundary in Indian Standard Time.
  - Days out and the overdue boundary.
  - Each report, the CSV and the offline backup file.
- There is no prior art: the repository has no code or tests yet.

## Out of Scope

- Insights charts, the Explore builder and drill-down (planned after this release).
- Marketing website and demo version.
- Serving more than one agency.
- Importing existing records.
- Tracking individual cylinders or cylinder sizes.
- Warehouses and internal transfers.
- Draft bills and editing returns.
- Quick-entry dispatch form.
- Customer sign-in and public sign-up.
- Prices, GST and invoicing.
- Email invitations and self-service password reset for staff.
- Automated browser tests.

## Further Notes

### Clerk setup

A GasFlow application exists in Clerk. Its development instance was configured on 26 November 2026:

- Username and password sign-in enabled.
- Email optional and not part of sign-up, still available for admin recovery.
- Sign-up restricted.
- Google sign-in off.
- Device trust off, because staff without an email cannot receive its second-factor challenge on a new device.
- Minimum password length 8, the lowest Clerk allows. The check against leaked passwords stays on.

Still to do:

- Confirm that an account with a username, password and no email can be created and can sign in.
- Apply the same settings to the production instance when it is created.

### To be supplied

- Logo.
- Any changes to the starting list of 10 gases.
- Prefix for return numbers (default `RET`) and prefixes for the other generated numbers.
- The start date.
- Clerk keys and the Neon connection string.

### Not yet decided

Do not block on these; ask the client when the work reaches them.

- Whether the start date can be changed once bills exist.
- Whether bills dated in the future are allowed.

### Build order

Follow the blueprint's build order, skipping Insights, the marketing site and the demo version. Add opening stock, add cylinders and write-off with the bill work, and allocations before the dashboard.
