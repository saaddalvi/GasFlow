# 09: Fill oldest first

**What to build:** on Receive empties, staff type one total for a gas and the app proposes how to split it across the oldest bills, which staff can adjust before saving. Covers user story 44.

**Blocked by:** 08: Receive empties.

**Status:** ready-for-agent

- [x] The API proposes the split and the screen only displays it
- [x] The total fills the oldest eligible bills of that gas first, including opening stock
- [x] Only bills dated on or before the return date are used, and changing the date updates the proposal
- [x] The proposed quantities appear in the rows and can be edited before saving
- [x] A total larger than eligible pending fills all of it and shows the excess; it is not silently dropped
- [x] Proposing a split saves nothing
- [x] API tests cover ordering, ties on the same date, the date limit and the excess

## Comments

**26 November 2026: built in commits `44f1ba5` and `38de2ba`.** Not pushed, so CI has not run on it.

How it works:

- `GET /api/returns/split?customerId&date&gasId&total` answers `{ rows: [{ billId, quantity }], excess }`. It uses the same order and date limit as the pending list (`listPending` in `apps/api/src/services/pending.ts`), so the two cannot drift apart. It saves nothing.
- On Receive empties, staff choose a gas, type a total and press **Fill oldest first** (or Enter in the total). The split replaces whatever was in that gas's rows and keeps each row's fill state. Rows can then be changed by hand.
- Changing the date asks for the split again. This overwrites any hand changes to that gas's rows.

Checked:

- Lint, type checks and 368 tests pass. `pnpm check` itself still stops on the untracked `.mcp.json`.
- The API tests cover the order (opening stock first, then by date), ties on one date (by the time entered, opening stock first), the date limit, the excess, a gas with nothing pending, that nothing is saved, and the refusals. The tie test was seen to fail with the entry-time order reversed.
- Driven with the Playwright MCP against real Clerk (admin account), on a cloned database: opening stock of 3 and bills of 4, 5 and 6 Medical oxygen. A total of 10 filled 3, 4 and 3; a total of 30 filled everything and said the other 12 were left over; a total of 0 was refused while the earlier excess stayed in view. Changing the date to 20 November left out the bill dated 25 November. After a hand change and an Argon fill, the return saved 11 as expected. Filling again after the save showed only fresh figures. No sideways scrolling at 360 or 1280 wide.
- This check found that a rename had changed the "Fill state" label to "Split state". Fixed in `38de2ba`.

For the project owner to decide:

- The gas list offers only gases with something pending on the date. Recording cylinders beyond that is ticket 10's unmatched returns.
- Leftover cylinders are named on screen but not put anywhere. Ticket 10 could offer to save them as unmatched.
- A total above 1,000,000 is refused.
