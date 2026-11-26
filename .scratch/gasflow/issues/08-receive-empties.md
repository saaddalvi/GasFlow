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

**26 November 2026: checks run in a browser. All passed except the real phone, which is still to do.**

Run in headless Chrome through the Playwright MCP against commit `44ac838`, signed in with real Clerk development accounts: an admin set the start date and entered opening stock, and a staff account entered the dispatch bills. The app and the database were copies, with the two new migrations applied to the copy only, and the figures were made up, not taken from paper copies.

- **Opening stock and several dispatch bills, then each bill page, Bills and the Stock report: passed.** One return of 20 cylinders (RET-20261126-001, slip S-55) covered opening stock and bills 101 and 102 in all three fill states. The bill pages showed the right sent, returned, pending, tags and return entries; **Bills** listed the return; the shop's counts rose in the chosen fill states and the totals did not change. After all the returns, the Stock report was right for today and for 15 November, which had a back-dated return.
- **Two people returning against the same bill: passed**, with an admin and a staff account each saving from a list loaded before the other saved. Asking for more than was left saved nothing and named what was pending. A row closed by the colleague left the list, with a warning about the quantity typed on it. Two quantities that both fitted both saved. Two requests of 5 against 7 pending, sent to the API at once, saved only one.
- **A real phone: still to do.** As a stand-in, Chrome emulated a phone with touch, 390 and 320 wide. Returns saved at both widths with the confirmation in view, and Receive empties did not scroll sideways. A real keyboard and Safari have not been tried.
- Also passed: the picker is focused on load and shows pending totals; rows are oldest first, with two lines of one gas on one row; changing the date changes the rows offered; a date before the start date is refused; Enter does not save; the API refuses a request without sign-in, a date before the bill or the start date, too many cylinders, another customer's bill and an inactive customer; a lost connection during a save keeps what was typed and says to check whether it was saved.

Found during the checks and fixed afterwards. The fixes were checked in the same browser, on a fresh copy:

- At 320 wide, the table under **Returns** on a bill page was wider than its box, so **Pending** was out of view until the table was swiped. Below 640 wide it now has smaller headings and less padding. It fits at 320 with the longest gas name and four-digit counts.
- In the list of returns on that page, each "returned" total sat at a different horizontal position on a narrow phone. They now line up at the right edge.
- After a refused save, the message stayed while the browser's own check blocked the next try. It now goes. This is in `ActionForm`, so it applies to every screen that uses it. A message still stays while fields are being changed, until the next try, as noted in ticket 07.
