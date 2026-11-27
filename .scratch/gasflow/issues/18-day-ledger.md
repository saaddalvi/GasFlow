# 18: Day ledger

**What to build:** staff reconcile the shop for any day. Covers user story 74.

**Blocked by:** 13: Add cylinders and write-offs.

**Status:** ready-for-agent

- [x] For a chosen date, the shop's Opening, In, Out and Closing counts are shown by gas with totals, in separate tables for Filled, Empty and, when used, Defective
- [x] There is a date picker with previous and next day, and no location selector
- [x] Dispatches, returns, refiller movements, add cylinders and shop write-offs count as In or Out
- [x] Opening stock forms the starting position and is not shown as In
- [x] Customer and refiller write-offs do not change the shop
- [x] Cancelled bills are excluded, and back-dated bills appear on their own date
- [x] Each day's closing equals the next day's opening and matches the Stock report

## Comments

**27 November 2026: built in commit `574cf74`, waiting on a check by hand.** Pushed since, as recorded at the end.

Still to do, signed in with real accounts. No migration is new.

- Open **Day ledger**. Check a busy day's Opening, In, Out and Closing against paper bills, and compare Closing with the shop on the Stock report for the same date.
- Use the date picker and previous and next day, on the start date and before it.
- On **Stock**, try the date picker, previous and next day and a shortcut, which it now shares with this screen.
- Look at the screen on a real phone.

How it works:

- `GET /api/reports/ledger?date=` answers `{ date, startDate, tables }`. Left out, the date is today. Each table has a `fillState`, an entry for each gas with `opening`, `in`, `out` and `closing`, and a `total`. `tables` is empty before the start date and until one is set.
- In and Out add up the day's posted bills, and are not netted against each other. Opening stock is part of Opening, also on the start date.
- Defective has a table when the shop has or moves any defective cylinders that day. Filled and Empty always have one.
- Every active gas has a column. A retired gas has one on days the shop has or moves some. All tables on a day have the same columns.
- The screen is at `/reports/ledger`, linked as **Day ledger** in the menu. It shares `components/report-day.tsx` and `components/report-table.tsx` with the Stock report.

Checked:

- `pnpm check`, with 723 tests, and `pnpm build` passed on the code committed.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database. Tried: today's figures against ones worked out by hand, previous and next day, the date box, the start date, a date before it, a nonsense date in the address, a negative count, and the date picker on the Stock report.
- No sideways scrolling of the page at 320, 390, 768, 1023, 1024, 1040, 1060 and 1280 wide on the Day ledger and Stock. The ledger's tables scroll sideways inside their cards below about 1024 wide.
- The new menu link first made the links wrap onto two lines between 1024 and about 1060 wide. Fixed by narrowing their padding below 1280, and checked again.
- The code review found no wrong or missing behaviour. Out of it came: the shared rule for a date in an address, some names, and a test of the In total. After those changes `pnpm check` and `pnpm build` passed. The screens were not driven again.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- The blueprint puts the reports under a **Reports** dropdown in the menu. The menu has them as separate links, and has no room for many more.
- "Defective, when used" is read day by day, so the table comes and goes as dates change. Say if it should stay once the agency has ever had a defective cylinder.
- As on the Stock report, a date after today can be chosen.

For later tickets:

- Tickets 19 and 20: `MOVEMENTS` in `services/holdings.ts` now has each movement's `bill_type`, to keep opening stock out of activity. A Reports dropdown would make room in the menu.
- Ticket 21: `reportDayLedger` gives the shop's In and Out for a day by fill state, which covers more bill types than the dashboard's dispatches and returns.

**27 November 2026: pushed.**

- Pushed up to `ecf9785`, and CI passed on it, as the project owner reported.
- The checks under "Still to do" are not recorded as done.

**27 November 2026: completed** in commit `574cf74`.

- The project owner asked for the ticket to be marked complete. No results of the checks under "Still to do", signed in with real accounts or on a real phone, are recorded here.
- The code committed in `574cf74` has not changed since.
- The decisions listed for the project owner are not recorded as settled.
