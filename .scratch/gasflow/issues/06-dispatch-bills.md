# 06: Dispatch bills

**What to build:** staff enter a dispatch bill from the paper copy, see it in the bill list and on its own page, and see stock change at once. Covers user stories 15, 25, 26, 29, 30, 31, 33 and 34.

**Blocked by:** 05: Opening stock and Stock report.

**Status:** ready-for-agent

- [x] The new bill form takes paper kind, bill number, date (with the weekday spelled out), customer, optional vehicle and notes, and gas lines with fill state and quantity
- [x] The shop is never chosen; only the customer is picked, from a searchable picker with "+ New" that adds a customer without losing the bill
- [x] Lines can be added and removed, one line per gas can be added in one action, and Filled, Empty and Total counts update as staff type
- [x] One "Save bill" button posts the bill; there are no drafts
- [x] A bill number already used by a posted bill of the same paper kind is flagged while typing and refused on save, in any year, including when two staff save it at once
- [x] The same number is accepted under the other paper kind
- [x] A date before the start date is refused; past dates after it count on that day
- [x] The bill list shows number, date, type, from and to, lines and status, a page at a time
- [x] The bill page shows the details, lines and who entered it
- [x] The Stock report reflects the dispatch; a dispatch larger than recorded shop stock is accepted and the negative count is flagged
- [x] The form is usable on a phone

## Comments

**26 November 2026: built in commit `a68f905`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first; the new screens and the bill pages fail until then.

- Enter a dispatch bill from a paper copy, then find it in **Bills**, open it and check the Stock report.
- Add a customer with **+ New** halfway through a bill.
- Type a number already used, under each paper kind.
- Enter and save a bill on a real phone. The phone box above stays open until this is done.
- Enter an opening stock again. Its form now shares the line list with the new bill form.

Checked so far:

- `pnpm check` (256 tests) passes. A production build passed on a copy of the app.
- The screens were driven in a headless Chromium browser at phone (320 and 375 wide), tablet and desktop widths, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. Nothing was run against Clerk. Safari, Firefox and a real phone have not been tried.
- With the API stopped, a failed save kept what had been typed.

For the project owner to decide:

- **Are bills dated in the future allowed?** The spec leaves this open. For now nothing refuses them, so a mistyped year saves a bill that today's stock does not show, and it cannot be fixed until tickets 11 (cancel) and 12 (correct).
- Bill numbers ignore capitals and surrounding spaces, so "a-17" is taken once "A-17" is. Leading zeros count: "012" and "12" differ. A number takes at most 30 characters.
- **+ One line per gas** adds lines that are left out of the bill if nothing about them is changed. A line that has been changed needs a quantity.
- Pressing Enter in a box on the new bill form does nothing, so that a half-entered bill is not posted. Only **Save bill** saves.
- A Defective total shows when a line is defective.
- **+ New** asks for name, mobile, contact person and address. The abbreviation is made from the name.
- An inactive customer or vehicle and a retired gas are refused.

Known limits:

- The customer picker lists the first 50 matches and asks for more of the name.
- That a cancelled bill frees its number (story 32) is set up in the database but cannot be tested until ticket 11.

For later tickets:

- Ticket 07: the check `bills_paper_kind_on_paper_bills` allows a paper kind on dispatches only, so a send to refiller has to be added to it. `refusingTakenNumber` in the ledger assumes that a repeat can only be the paper number, which a refiller's slip number will change.
- Ticket 12: the number warning has to leave out the bill being corrected.
- Tickets 07, 12 and 13: bill forms share `LineList` in `apps/web/components/line-fields.tsx`.

**26 November 2026: completed** in commits `a68f905` and `0d06bae`. Both are pushed; the CI result has not been checked.

- The project owner asked for the ticket to be marked completed. No results of checks on a real phone or signed in with real accounts were recorded here.
- The checks under "Still to do" were run through Playwright MCP in headless Chromium, with sign-in replaced by the identity stand-in, on a copy of the development database. The phone was an emulated Pixel 7, and the bill was made-up data, not a paper copy.
- Those checks passed except that below 360 pixels wide the new bill form spilled past its card. `0d06bae` fixes this. The fix was checked at 320, 340, 360, 412 and 768 wide on a copy of the app, and `pnpm check` (256 tests) passes with it.
- Both new migrations were applied to the development database.
- The decisions listed for the project owner are not recorded as settled.
