# 05: Opening stock and Stock report

**What to build:** an admin sets the start date and enters opening stock for the shop, customers and refillers, and staff see the result in the Stock report for any date. This is the first bill, so it establishes the single bill ledger that owns every change to bills. Covers user stories 11, 20 to 23, 73 and 78.

**Blocked by:** 04: Parties, gases and vehicles.

**Status:** ready-for-agent

- [x] An admin sets the start date once during setup
- [x] An admin enters a party's opening stock as lines of gas, fill state and quantity; suppliers are not offered
- [x] Opening stock is always dated the start date, is numbered automatically, and is posted when saved
- [x] A second opening stock for the same party is refused, including when two are saved at the same moment
- [x] Staff who are not admins cannot enter opening stock
- [x] Existing opening stock entries are listed and each can be viewed, showing who entered it and when
- [x] Every bill change goes through one ledger module that checks rules and writes in a single database transaction
- [x] The Stock report shows, by gas, the shop as Filled, Empty and Defective, then With customers, At refiller and Total, calculated from posted bills with no stored stock count
- [x] Customer and refiller counts add quantities across fill states
- [x] The report has a date picker, month-end shortcuts and previous and next day; dates before the start date show nothing
- [x] Negative counts are shown in a red cell
- [x] API tests enter opening stock and assert the report figures

## Comments

**26 November 2026: built in commit `bb5de85`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first.

- As an admin, set the start date. It cannot be changed in the app, so choose it with care even on the development database.
- Enter opening stock for the shop, a customer and a refiller, and view an entry.
- As staff, check that entries can be listed and viewed, and that there is no entry form.
- On the Stock report, use the date picker, the month-end shortcuts, previous and next day, and a date before the start date.
- Check by hand in the browsers and on the phones the agency will use. Safari, Firefox and a real phone have not been tried.

Checked so far:

- `pnpm check` (200 tests) and `pnpm build` pass.
- The screens were driven in a headless Chromium browser at phone, tablet and desktop widths, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. Nothing was run against Clerk.
- No bill can yet make a count negative, so the red cell was checked only with rows put straight into a throwaway database. Ticket 06 can check it through the app and the API tests.

For the project owner to decide:

- **Can the start date be changed once opening stock exists?** The spec leaves this open. For now it is set once, and a mistake can only be undone in the database.
- A start date after today is refused, because cylinders cannot be counted on a day that has not come. This also means it cannot be set the evening before.
- A start date before 2000 is refused. A bill takes at most 100 lines, and a line at most 100,000 cylinders.
- Opening stock numbers look like `OPN-20261101-001`, from the start date. The client has yet to supply the prefix.
- An inactive party and a retired gas are refused on opening stock.
- A wrong opening stock cannot be fixed until tickets 11 (cancel) and 12 (correct).
- The opening stock page is at `/bills/opening-stock/new`.
- The glossary has no entry for posted.

Known limits:

- Dozens of saves arriving at once over a slow database link can fail with a server error, saving nothing. Saves of one date wait their turn for a number, and give up after a few seconds. Check this against Neon at go-live.
- If a colleague sets the start date while another admin's box is open, the box closes without saying why. The page then shows the date that was set.
- A long party name with no spaces probably widens the party page on a phone, as it did the bill page before that was fixed. Seen only on the bill page.

For later tickets:

- Only `apps/api/src/services/ledger.ts` changes bills. A bill moves cylinders from `fromPartyId` to `toPartyId`; a blank side is outside the business.
- The Stock report already subtracts what leaves a party, which no test can reach until there is a dispatch.
- Ticket 12: bill lines are unique by bill and line number, so renumbering lines that stay needs two steps.

**26 November 2026: completed** in commit `bb5de85`. It is pushed, and [CI passed](https://github.com/saaddalvi/GasFlow/actions/runs/45786807915) at `070317c`.

- The project owner asked for the ticket to be marked completed. No results of the signed-in checks under "Still to do" were recorded here.
- Both new migrations were applied to the development database.
- The decisions listed for the project owner are not recorded as settled.
