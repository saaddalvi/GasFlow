# 16: Overdue and pending returns

**What to build:** staff see which cylinders have been out longest and which are overdue. Covers user stories 68 to 70.

**Blocked by:** 08: Receive empties.

**Status:** ready-for-agent

- [x] A pending returns list shows every pending bill and gas with customer, bill date, quantity and days out, longest first, a page at a time
- [x] Opening stock appears in it, with days out counted from the start date
- [x] The overdue limit starts at 30 days and only an admin can change it
- [x] Cylinders are overdue when days out exceed the limit; tests cover the day on the limit and the day after
- [x] Overdue rows are highlighted on the pending returns list and on Receive empties
- [x] Changing the limit updates the highlighting at once
- [x] Each row links to its bill and to Receive empties for that customer

## Comments

**27 November 2026: built in commit `051d8b3`, waiting on a check by hand.** Pushed since, as recorded at the end.

Still to do, signed in with real accounts. **Run `pnpm db:migrate` first**: Receive empties, matching, customer write-offs and Pending returns all need the new migration.

- Open **Receive empties**, then **Pending returns**. Compare the order and days out with a few paper bills, and follow a row to its bill and to **Receive empties**.
- As admin, change the overdue limit and watch the highlighting follow on both screens. As staff, see that **Change limit** is not offered.
- Look at both screens on a real phone.

How it works:

- `GET /api/overdue-limit` answers `{ days }`. `PUT` with `{ days }` is for admins and takes a whole number from 1 to 3650.
- The `overdue_limit` table is empty until an admin changes the limit, and an empty one means 30.
- `GET /api/reports/pending-returns?page=` lists one row for each bill and gas with cylinders pending, from every customer, the oldest bill date first, 50 to a page.
- Its rows, and those of `GET /api/returns/pending`, have `daysOut` and `overdue`. Both are worked out as they are read.
- The screen is `/returns/pending`, reached from a button on **Receive empties**. `/returns/new?customerId=` opens **Receive empties** with that customer chosen.

Checked:

- `pnpm check`, with 644 tests, and `pnpm build` passed on the code committed.
- Three tests of the limit's boundary failed when `>` was changed to `>=`, as they should.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database. Tried: highlighting at 31 and 30 days, the second page, a page past the end, changing the limit, a row's link to **Receive empties**, saving a return from there, the menu link starting the form afresh, an unknown or inactive customer in the address, and the staff view.
- No sideways scrolling at 320, 390, 640, 768, 1024 and 1280 wide. At 320 a long customer name was first squeezed into a thin column on **Pending returns**; the phone layout was changed and checked again.
- After those browser checks, only names and a shared constant for the 3650 maximum changed.
- The code review found one use of "age", a word the glossary avoids, in names in the code. It was changed.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- User story 69 asks for overdue cylinders to stand out wherever pending cylinders are shown. This ticket names two screens. The bill page, the customer write-off form and **Match to bill** do not mark them. Ticket 17 covers the customer's page; no ticket covers these three.
- An inactive customer's rows are listed, with **Inactive customer** linking to their page in place of **Receive empties**, as their returns are refused.
- The overdue limit is at most 3650 days.
- The limit is changed on **Pending returns**, as there is no settings menu.
- **Pending returns** is not in the top menu, which looked too full at 1024 wide to take another link. This was not tried.
- A bill dated after today is listed last, with 0 days out.

For later tickets:

- Ticket 17: `receiveEmptiesFromPath` in `lib/routes.ts` opens **Receive empties** for a customer. `components/days-out.tsx` shows days out and marks overdue rows.
- Ticket 21: the pending returns card can link to `/returns/pending`. Its totals of cylinders, customers and overdue ones are not given by the list, which answers a page at a time.

**27 November 2026: completed** in commit `051d8b3`.

- Pushed up to `ab2d58e`, and [CI passed on it](https://github.com/saaddalvi/GasFlow/actions/runs/45979457440).
- The project owner asked for the ticket to be marked complete. No results of the checks under "Still to do", signed in with real accounts or on a real phone, are recorded here.
- The new migration, `20261127110000_add_overdue_limit`, has been applied to the development database.
- The code committed in `051d8b3` has not changed since.
- The decisions listed for the project owner are not recorded as settled.
