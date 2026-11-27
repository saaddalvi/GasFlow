# 17: Customer and refiller pages

**What to build:** the party list and each party's page give the full picture of what that party holds. Covers user stories 18, 39, 66, 67 and 69.

**Blocked by:** 10: Unmatched returns; 11: Cancel bills and Undo; 16: Overdue and pending returns. (Ticket 07 is covered through 11.)

**Status:** ready-for-agent

- [x] The party list shows summary figures (active parties by type, with customers, at refillers, below zero) and, per party, the holding now and last bill
- [x] A party's page shows its holding by gas, this month's sent, returned and net out, its bills (active, cancelled or all) and a daily summary, with a date range picker
- [x] A customer's page lists pending bills with days out, highlights overdue ones and shows any unmatched returns
- [x] Receive empties opens from a customer's page with that customer chosen
- [x] Deactivating a party that holds cylinders, including a negative holding, or has unmatched returns is refused with the reason
- [x] A party with nothing held and nothing unmatched can be deactivated, and its history stays readable

## Comments

**27 November 2026: built in commit `6f15394`, waiting on a check by hand.** Pushed since, as recorded at the end.

Still to do, signed in with real accounts. No migration is new.

- Open **Parties**. Compare the four figures, and a few holdings and last bills, with what is expected.
- Open a customer's page. Check **Holds now**, **This month**, **Pending bills** and **Unmatched returns** against paper bills, then both tabs with a date range, and **Active**, **Cancelled** and **All**.
- Open a refiller's and a supplier's page.
- Try to deactivate a customer with cylinders out, then deactivate one with none and check that its bills can still be read.
- Look at both screens on a real phone.

How it works:

- `GET /api/reports/parties` takes what `GET /api/parties` takes. It adds to each party `holding` (null for a supplier) and `lastBill`, and gives a `summary` of all parties.
- `GET /api/parties/:partyId/holding` answers the gases held, their total and `thisMonth` (sent, returned and net out).
- `GET /api/parties/:partyId/daily-summary?from&to&page` lists the days with cylinders sent or returned, the newest first, 50 to a page.
- `GET /api/bills?partyId=`, `GET /api/reports/pending-returns?customerId=` and `GET /api/returns/unmatched?customerId=` narrow those lists to one party. The Bills, Pending returns and Unmatched returns screens ignore these in their addresses.
- `PATCH /api/parties/:partyId` refuses to make an active party inactive while it holds any gas, even fewer than none, or has unmatched returns. It holds the party's lock, as saving a bill does.
- **Sent** is dispatches or sends to a refiller. **Returned** is returns, matched or not, or returns from a refiller. Opening stock and write-offs are neither.
- The date range narrows the bills and the daily summary. **This month** stays the calendar month in India.
- Three older tests deactivated a customer with cylinders out. Their set-up now receives the cylinders first.

Checked:

- `pnpm check`, with 705 tests, and `pnpm build` passed on the code committed.
- The test of a dispatch and a deactivation sent at once failed three times out of three with the party's lock taken out of deactivation.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database. Tried: both lists' figures, both tabs, the date range, the choice of bills, **Reset**, paging of pending bills, bills and days, pages past the end, **Match to bill** from a customer's page, **Receive empties** from it, a refused deactivation from the page and from the edit form, a deactivation that was allowed, and the refiller and supplier pages.
- No sideways scrolling at 320, 390, 640, 768, 1024 and 1280 wide on the party list and party pages.
- The code review found all six criteria met and no hard breach of the project's standards. Out of it came: the Bills screen ignoring a party named in its address, one row component for both pending lists, and some names and paths tidied. After those changes `pnpm check` and `pnpm build` passed, and **Pending returns**, a customer's page, adding and editing a party and the links to a party's page were driven again.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- **Holds now**, the party list's figures and the deactivation check count every posted bill, even one dated after today. The Stock report for today does not, so the two can differ while such a bill exists. Whether bills may be dated in the future is still undecided.
- User story 69 asks for overdue cylinders to stand out wherever pending cylinders are shown. The customer's page now does. The bill page, the customer write-off form and **Match to bill** still do not, and no ticket covers them.
- Cancelling or correcting a bill can leave an inactive party holding cylinders. It is counted in the figures above the party list, and listed when **Show inactive** is ticked.
- **Below zero** counts the customers and refillers with any gas below zero, not the counts below zero.
- The bills on a party's page start at **Active**, with no date range.
- The party list no longer has an Abbreviation column. The abbreviation is on the party's page.
- The blueprint's **Opening stock** button on a party's page is not there, as this ticket does not ask for it.

For later tickets:

- Ticket 19: `findHoldings` in `services/holdings.ts` gives holdings as of now. The balance register needs them as of a date; `MOVEMENTS` has each movement's date.
- Ticket 20: the **Stock card** button belongs in the heading of a party's page.
- Ticket 21: `sumHoldings` counts every posted bill. Decide whether the dashboard's figures should match it or the Stock report.

**27 November 2026: completed** in commit `6f15394`.

- Pushed up to `85ecf46`, and [CI passed on it](https://github.com/saaddalvi/GasFlow/actions/runs/45983411933).
- The project owner asked for the ticket to be marked complete. No results of the checks under "Still to do", signed in with real accounts or on a real phone, are recorded here.
- The code committed in `6f15394` has not changed since.
- The decisions listed for the project owner are not recorded as settled.
