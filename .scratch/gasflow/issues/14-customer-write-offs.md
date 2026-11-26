# 14: Customer write-offs

**What to build:** an admin writes off a customer's lost cylinders against a chosen bill, so they stop showing as pending. Covers user stories 37, 59 and 63.

**Blocked by:** 13: Add cylinders and write-offs.

**Status:** ready-for-agent

- [ ] An admin chooses a customer, then a dispatch bill or opening stock with pending cylinders, a gas, a quantity, a date and a reason
- [ ] The quantity is limited to that bill's pending cylinders, the date cannot be before the bill's, and a customer write-off is never unmatched
- [ ] Pending and the customer's holding fall, the shop is unchanged, and the business total falls
- [ ] The dispatch bill page shows sent, returned, written off and pending, lists each write-off, and counts write-offs towards its tag
- [ ] A customer write-off cannot be corrected, only cancelled and entered again; cancelling restores pending
- [ ] A dispatch bill or opening stock with a write-off is protected from cancellation and contradicting corrections, like one with returns
- [ ] A write-off and a return against the same pending cylinders sent at the same moment cannot both over-clear the bill
- [ ] A customer's holding of each gas still equals pending minus unmatched

## Comments

**27 November 2026: built in commit `91cb4e3`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. No migration is new.

- As admin, write off from a customer's dispatch bill and from opening stock. See the bill page, **Receive empties** and the Stock report follow, then cancel one.
- Try to cancel and to correct a bill that has a write-off, and follow the links in the refusal.
- As staff, see that **New bill** offers no write-off and that a write-off offers no **Cancel bill**.
- Enter a customer write-off on a real phone.

How it works:

- A customer write-off is entered with `POST /api/customer-write-offs`, which takes `{ customerId, billId, gasId, quantity, writeOffReason, date, notes }` and answers the new bill. It is a `write_off` bill from the customer with one line, matched to the chosen bill as a return is.
- Pending rows, and a bill's `returns`, now have `writtenOff`. Each of `returns.entries` has a `type`, `return_from_customer` or `write_off`.
- `whyUncorrectable` now also looks at whom the bill is from, and refuses a customer write-off.
- Refusals that protect a bill name returns, write-offs or both, as is in the way.
- On screen it is **New bill**, **Write-off**, **Written off from: A customer**. The dispatch bill and opening stock pages head the section **Returns and write-offs**. A row on **Receive empties** shows **Written off** only when there are some.

Checked:

- `pnpm check` passes, with 597 tests, and `pnpm build` passes.
- The concurrency test was tried with the customer lock removed, and failed as it should.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database. A customer write-off was entered from a dispatch bill and from opening stock, one was cancelled, a save refused because less was pending was tried, as was cancelling a bill with returns and a write-off. A write-off's correction page said why it cannot be corrected, a shop write-off was still entered and saved from its correction form, and staff were offered no write-off type.
- No sideways scrolling at 320, 390, 768 and 1280 wide on the new write-off form, a dispatch bill page and **Receive empties**. At 320 the per-gas table at first cut off **Pending** and the bill list's text was cut short; both were changed, and the table was measured again at 320 and 390.
- The code review found that the form could move to a bill's other gas, keeping the typed quantity, once the chosen gas was no longer pending. Fixed, and tried again on screen.
- Safari, Firefox and a real phone have not been tried. A write-off's own page was not checked at narrow widths.

For the project owner to decide:

- The form asks for no fill state, as it counts only at the shop. The line is saved, and shown, as **Empty**.
- One write-off clears one gas on one bill. Lost cylinders on two bills are two write-offs.
- A write-off's own page does not say which bill it cleared, as a return's does not. The bill's page lists it.
- As on other bills, an inactive customer cannot be named. To write off an inactive customer's cylinders, make them active first.

For later tickets:

- Tickets 15 and 16: a bill's pending is sent less returned less written off. A bill can be closed with nothing returned.
- Ticket 20: write-offs have allocations too, so a stock card showing the bill each return went against may want the same for them.
