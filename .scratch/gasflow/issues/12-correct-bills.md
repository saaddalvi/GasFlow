# 12: Correct bills

**What to build:** staff correct a posted bill and the earlier versions stay readable, without ever contradicting recorded returns. Covers user stories 24, 56, 57, 61 and 62.

**Blocked by:** 11: Cancel bills and Undo.

**Status:** ready-for-agent

- [x] Dispatches, sends to a refiller, returns from a refiller and opening stock can be corrected, and all figures update
- [x] Returns cannot be corrected, only cancelled
- [x] Staff can correct only bills they entered today (Indian Standard Time); admins can correct any; only admins can correct opening stock
- [x] Number and start date rules apply to corrections
- [x] Each correction keeps the earlier version; the bill page shows an "Edited" mark and lists versions, each viewable with who changed it and when
- [x] Lines that have allocations keep their identity through a correction
- [x] A correction is refused if it changes the customer of a bill with allocations, removes an allocated gas, lowers a gas below its allocated quantity, or moves the date after an allocated return; the refusal links to each blocking bill
- [x] A permitted correction, such as raising a quantity, updates pending
- [x] A correction and a return against the same bill sent at the same moment cannot leave a bill over-returned

## Comments

**27 November 2026: built in commit `963ce5f`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first; the bill page needs the new table.

- As staff, correct a bill entered today, and see that an older one and a colleague's offer no **Correct bill**.
- Correct a send to refiller and a return from refiller on screen.
- Correct a bill on a real phone.

How it works:

- `PUT /api/bills/:billId` takes the whole bill again, as the new bill form sends it, with the same `type`. Opening stock takes `{ type, lines }`. It answers the bill, which now has `lastCorrection` and `earlierVersions`.
- `correctBill` in `apps/api/src/services/ledger.ts` locks the bill, then the party it names and the party it is to name. `cancelBill` now locks the bill first too, since a correction can change the party.
- `bill_revisions` holds each replaced version as the API reported it, so it keeps the names of that time.
- Lines are paired by gas. Those with returns matched to them keep their ids first, and allocations move to other lines of the gas only so far as they no longer fit. Merging two lines that both have returns keeps one of the two ids.
- Who may correct is `whyNotCorrect`, and whether anyone can is `whyUncorrectable`, both in `packages/shared/src/bill.ts`.
- A refusal because of returns carries `blockingBills`, the oldest return first.
- The screen is `/bills/[billId]/correct`. The bill page shows **Edited** and a **Versions** list.

Checked:

- `pnpm check` passes, with 527 tests, and `pnpm build` passes.
- The tests of a correction sent at the same moment as a return or a match fail when the party lock is taken out of correcting. The test of two bills swapping customers fails when the locks are not taken in order. The test of cancellations sent at once fails without the lock on the bill.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. Nothing was run against Clerk. As staff, a dispatch was refused with a link to the return in the way, then saved, and its earlier version opened. As admin, opening stock was corrected. A retired gas and an inactive vehicle stayed on the bill's own form, a taken number was warned of and refused, and the form stayed up when the bill was cancelled meanwhile. The dispatch's bill page and correction page had no sideways scrolling at 320, 768 and 1280 wide, nor had the opening stock correction at 320.
- That browser check came before the fixes from the code review, which changed which lines keep their ids and moved the bill page's detail rows into `bill-parts.tsx`. Those fixes passed the checks above but were not looked at in a browser. Refiller bills, Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- Opening stock is corrected in its lines only. One entered for the wrong party is cancelled and entered again.
- A bill's type cannot be changed.
- A correction may keep an inactive party or vehicle, or a retired gas, that the bill already names, and may raise its quantities. It cannot newly name one.
- No reason is asked for a correction.
- Saving a correction that changes nothing keeps no version and adds no **Edited** mark.

Known limits:

- If two people have the same bill's form open, the second save replaces the first without warning. The first stays in the versions.
- Following a link to a bill in the way leaves the form, and what was typed is lost.
- A correction that removes a line also removes what cancelled returns had matched to it. Nothing reads that.
- Two corrections that swap two bills' numbers at the same instant would probably end with one answered "Something went wrong". This has not been tried.

For later tickets:

- Tickets 13 and 14: new bill types need adding to `billCorrectionSchema` and `correctBill`, which takes any bill not copied from paper to be opening stock. A customer write-off goes in `whyUncorrectable`. The refusals speak of returns only, and would name a write-off as one.
- Ticket 13: a field added to `billContentSchema` needs a default, or versions saved before it will not load.
- Ticket 17: a correction can leave an inactive party holding cylinders.

**27 November 2026: checks run in Chrome. All passed. A real phone is still to do.**

Run in Chrome through the Playwright MCP against commit `963ce5f` (the code at `ce44550`), signed in with real Clerk development accounts (`admin` and `test1`). The app and the database were copies, and the figures were made up. Test bills were created through the API; the corrections below were made on screen.

- **Who is offered Correct bill: passed.** Staff were offered it on three bills they entered that day, and not on an older one, the admin's, opening stock or a return. Each of those correction pages said why, and the API refused. The admin was offered it on all but the return. The older bill was made by moving its entry time back a day in the copy.
- **Send to refiller: passed.** The form started with what the bill said. A taken number was warned of and refused, and the bill's own was not warned of. Its refiller, number, vehicle, notes and quantity were changed.
- **Return from refiller: passed.** The same for the slip number. A quantity was lowered and a line added. The Stock report followed both refiller corrections.
- **A dispatch with a return: passed.** A later date, another customer and too few cylinders were each refused with a link to the return, and the link opened it.
- **Admin: passed.** An older bill and opening stock were corrected, and each showed its earlier version.
- **Correcting on a phone: passed on an emulated phone** (touch, 390 wide). A dispatch was refused, then saved, and its earlier version opened.

No sideways scrolling on the refiller bills' pages and correction pages or opening stock's at 320, 768 and 1280, or on the dispatch's at 390. No page errors were raised, and the API answered no request with a server error. The one console error was a missing `favicon.ico`.

Seen:

- In the **Versions** list, an opened earlier version lost its rounded bottom corners. Fixed afterwards in `d83cc12`.
- On the phone, a refusal appears half below the screen, so the link to the bill in the way has to be scrolled to. Not fixed.

Still to do: correct a bill on a real phone. Safari and Firefox have not been tried.

**27 November 2026: completed** in commits `963ce5f` and `d83cc12`. Not pushed when this was written, so CI has not run on them.

- The project owner asked for the boxes to be ticked. No results of a check on a real phone are recorded here. The phone check was on the emulated phone described above.
- `pnpm check`, with 527 tests, and `pnpm build` pass with the corner fix. The fix was looked at in Chrome on a copy of the box's markup with the app's built styles, not on the bill page itself.
- The decisions listed for the project owner are not recorded as settled.
