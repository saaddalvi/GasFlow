# 08: Receive empties

**What to build:** staff pick a customer, type how many cylinders came back against each dispatch bill and save; each dispatch bill then shows what is returned and pending. This is the most important feature. Covers user stories 38 to 43, 45 to 48, 52, 63 and 80.

Excess cylinders are refused in this ticket; unmatched returns arrive in ticket 10.

**Blocked by:** 06: Dispatch bills.

**Status:** ready-for-agent

- [ ] The customer picker is focused on load, searchable, and shows each customer's total pending
- [ ] Pending cylinders are listed oldest first, one row per bill and gas, with sent, returned, pending and days out; a bill with several lines of one gas shows one row
- [ ] The customer's opening stock appears as "Opening stock" and takes returns like a dispatch bill
- [ ] Closed rows are hidden behind a "Show closed bills" link
- [ ] Each row takes a quantity, has an "All" button, and has a fill state that defaults to Empty
- [ ] The date defaults to today and can be changed; only bills dated on or before it are offered, and the API refuses any other allocation
- [ ] A date before the start date is refused
- [ ] An optional slip number can be noted, with no uniqueness rule
- [ ] One save creates one return, numbered automatically such as `RET-20261126-001`, with allocations across bills, posted at once
- [ ] More than a row's pending quantity is refused and nothing is saved
- [ ] Two saves against the same pending cylinders at the same moment, on separate database connections, never over-return a bill
- [ ] A confirmation names the customer, quantity and bill numbers
- [ ] The dispatch bill page shows sent, returned and pending, an Open, Partly returned or Closed tag, and each return with date, quantity, return number and who entered it
- [ ] The customer's holding equals pending, and the shop's counts rise in the chosen fill states
- [ ] Receive empties is reachable from the navigation and usable on a phone

## Comments

**26 November 2026: built in commit `a56277d`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first; returns, the bill list and the bill pages need the two new migrations.

- Receive empties from a customer who has opening stock and several dispatch bills, then check each bill page, **Bills** and the Stock report.
- Save a return on a real phone.
- Have two people return against the same bill, one saving after the other.

Checked so far:

- Lint, type checks and 357 tests pass, and so does the formatting of every committed file. `pnpm check` itself stops on the untracked `.mcp.json`, which is not formatted.
- The test of saves at the same moment fails when the customer lock is taken out.
- The screens were driven in a headless Chromium browser, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. Receive empties was checked for sideways scrolling at 320, 360, 390, 768, 1024, 1100 and 1280 wide, and saving on an emulated phone at 320 and 390 wide. Nothing was run against Clerk. Safari, Firefox and a real phone have not been tried.
- The new bill form's party picker now shares its search box with Receive empties. Choosing a customer and **+ New** were tried again.

For the project owner to decide:

- An inactive customer is not offered and the API refuses their return, as for other new entries. Nothing yet stops deactivating a customer who holds cylinders (ticket 17).
- Cylinders of a retired gas can still be returned.
- The date goes back to today after each save.
- **Returns dated in the future are not refused**, as for other bills. The spec leaves this open.
- Days out counts to today, whatever the return date.
- A return has one line for each gas and fill state, however many bills they were returned against.
- Enter in a box does not save. Only **Save returns** does.
- Closed rows are listed newest first, 50 to a page.

Known limits:

- **A wrong return cannot be undone until ticket 11** adds cancelling and Undo.
- Cylinders beyond what is pending are refused until ticket 10.
- A row takes one fill state at a time. To return one row in two fill states, save twice.
- A quantity typed on a row that then leaves the list, because the date changed or a colleague saved first, is not saved. The form says how many were left out.
- The customer picker lists the first 50 matches and asks for more of the name.

For later tickets:

- Ticket 09: "oldest first" is `OLDEST_FIRST` in `apps/api/src/services/pending.ts`: date, then opening stock, then the time entered.
- Ticket 10: an unmatched quantity is what a return line holds beyond its allocations.
- Ticket 11: only posted returns count against pending, so cancelling one restores it. A cancellation has to lock the customer, as `receiveReturn` does.
- Ticket 12: allocations point at bill lines, so a correction has to keep those lines.
- Ticket 14: `CLEARABLE_LINES` and `getBillReturns` treat every posted allocation as a return. Write-offs have to be told apart in both.
- Ticket 17: the Receive empties form cannot yet be opened with a customer already chosen.
