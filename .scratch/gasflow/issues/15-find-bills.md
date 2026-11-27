# 15: Find bills

**What to build:** staff find any bill with filters and spot dispatches that still have cylinders pending. Covers user stories 64 and 65.

**Blocked by:** 07: Refiller bills; 08: Receive empties.

**Status:** ready-for-agent

- [x] The bill list filters by bill number, slip number, paper kind, type, party name and date range, alone or combined, with a reset
- [x] The total number of matching bills is shown
- [x] Dispatch bills show how much has been returned, such as `3 / 5`
- [x] A pending returns filter shows only dispatch bills with cylinders pending
- [x] Filtering and paging happen in the API
- [x] Bills sharing a number across paper kinds or refillers can be told apart by type, date and party

## Comments

**27 November 2026: built in commit `5826e25`, waiting on a check by hand.** Pushed since, as recorded at the end.

Still to do, signed in with real accounts. No migration is new.

- On **Bills**, try each filter alone and a few together, page through a long result, then **Reset**.
- Search with **Only dispatches with cylinders pending**, receive empties against one of the bills and search again.
- Search the bill list on a real phone.

How it works:

- `GET /api/bills` also takes `number`, `slipNumber`, `paperKind`, `type`, `party`, `from`, `to` and `pending=true`, beside `status` and `page`. A blank one narrows nothing.
- `number`, `slipNumber` and `party` match any part, in any capitals. `from` and `to` include both ends, and a `from` after `to` matches nothing.
- Each listed bill has `returns`, which is `{ sent, returned, writtenOff, pending }` on a posted dispatch and `null` on any other bill.
- On screen, the **Returned** column reads `3 / 5`, with any written off under it. The number of matching bills is above the table.

Checked:

- `pnpm check`, with 619 tests, and `pnpm build` passed on the code committed. In one further `pnpm check` run, just before the commit, one test timed out after 5 seconds. Its name was not captured. The next four runs of the tests passed.
- The screen was driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database. Searches by party with pending, bill number, paper kind with type, slip number and date range were tried, as were the next page, **Reset**, a reversed date range and a page past the end.
- No sideways scrolling at 320, 390, 640, 768, 1024 and 1280 wide.
- The code review found no requirement missing and no hard breach of the project's standards. A shared type for the return counts and clearer names came out of it.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- **Party name** never matches the shop, which is on nearly every bill. The shop's own opening stock and write-offs are found by **Type** or number.
- **Slip number** searches only the slip number noted on a customer's return. A refiller's slip number is that bill's number, so it is searched under **Bill number**, as a hint there says.
- The pending filter lists dispatch bills only, as this ticket asks. Opening stock with cylinders pending is not in it.
- On a phone the filters fill the first screen, so the results start below it.

For later tickets:

- Ticket 16: its list takes opening stock too, so it needs more than `findPendingDispatchIds` in `services/pending.ts`.
- Ticket 17: the bill list narrows by part of a party's name, not by one party. A party's page needs the latter.
- Ticket 21: dashboard figures can link to the list with `type`, `from`, `to` and `pending=true`.

**27 November 2026: completed** in commit `5826e25`.

- Pushed up to `90729ee`, and [CI passed on it](https://github.com/saaddalvi/GasFlow/actions/runs/45975252389).
- The project owner asked for the ticket to be marked complete. No results of the checks under "Still to do", signed in with real accounts or on a real phone, are recorded here.
- The code committed in `5826e25` has not changed since. The test that timed out in one local run has not been identified.
- The decisions listed for the project owner are not recorded as settled.

