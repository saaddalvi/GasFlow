# 19: Balance register

**What to build:** staff review what every party holds on a date. Covers user story 75.

**Blocked by:** 07: Refiller bills.

**Status:** ready-for-agent

- [ ] For a chosen date, each customer and refiller is listed with type, a gas breakdown and the total held
- [ ] Rows expand to the full breakdown by gas
- [ ] The list filters by party type, non-zero or all, and name
- [ ] A header states how many parties, how many cylinders held and how many are below zero
- [ ] Negative holdings are flagged
- [ ] The shop and suppliers are not listed as holders
- [ ] Figures match the Stock report for the same date

## Comments

**27 November 2026: built in commit `48d1dd1`, waiting on a check by hand.** Pushed since, as recorded at the end.

Still to do, signed in with real accounts. No migration is new.

- Open **Reports**, then **Balance register**. Check a few parties against paper, and compare the figures with **With customers** and **At refiller** on the Stock report for the same date.
- Choose an earlier date in the date box, the start date and a date before it. Narrow by type and name, and show all parties.
- Open and close some rows.
- Try the **Reports** menu, and the menu on a real phone.

How it works:

- `GET /api/reports/party-balance?date=&type=&show=&search=&page=` answers `{ date, startDate, parties, summary, total, page, pageSize }`. Each party has `id`, `type`, `name`, `active`, `gases` and `total`, and `summary` has `held` and `belowZero`. Left out, the date is today and `show` is `non_zero`; the other value is `all`. `type` is `customer` or `refiller`. Nothing is listed before the start date or until one is set.
- The header is of every party the filters leave, on every page together.
- Non-zero is judged gas by gas, so a party with 5 of one gas and 5 fewer than none of another is listed, with a total of 0.
- A party is below zero when any gas is, as on the Parties screen.
- Inactive parties are listed, tagged, for dates they held something, and always with **All parties**.
- Each request reads every customer and refiller of the type and name asked for, then pages them, because the header adds up all of them.
- `findHoldings` in `services/holdings.ts`, which the party pages use too, now takes a date.
- The screen is at `/reports/party-balance`, the blueprint's address. A row names its first two gases and opens to show every gas.
- The menu now has a **Reports** dropdown with Stock, Day ledger and Balance register, as the blueprint does and as ticket 18 suggested. Staff comes before it. On a narrow screen the links are listed under **Operational** and **Reporting**.

Checked:

- `pnpm check`, with 754 tests, and `pnpm build` passed on the code committed.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database.
- Tried before the review: the header against figures worked out by hand, opening and closing a row, the second page, the type, name and show filters, Reset, an inactive party, a search that matches nothing, the start date, a date before it, a nonsense address, a page past the end, and negative counts. Dates were chosen through the address, not typed into the date box.
- At 320 wide an opened row broke gas names into a few letters a line. The breakdown now sits under the party's name on narrow screens, and was checked again.
- The code review found no wrong figures. Out of it came: the blueprint's address, the two menu groups, a menu that stays open when a heading is tapped, some names, and test helpers moved to `test/support/agency.ts`. After those changes the register showed the same header at 320, 390, 768, 1023, 1024, 1040, 1060 and 1280 wide with no sideways scrolling, the menu links stayed on one line, and the menus opened and closed as meant, including for staff who are not admins.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- **All parties** includes inactive ones. Say if it should leave out those holding nothing.
- There are no previous and next day buttons, which the ticket did not ask for.
- As on the Stock report, a date after today can be chosen.

For later tickets:

- Ticket 20: the card's closing holding for an end date should match `findHoldings` for that date.
- Ticket 21: the Balance register tile can link to `BALANCE_REGISTER_PATH`.

**27 November 2026: pushed.**

- Pushed up to `b1370d5`, and CI passed on it, as the project owner reported.
- The checks under "Still to do" are not recorded as done.
