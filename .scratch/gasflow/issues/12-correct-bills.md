# 12: Correct bills

**What to build:** staff correct a posted bill and the earlier versions stay readable, without ever contradicting recorded returns. Covers user stories 24, 56, 57, 61 and 62.

**Blocked by:** 11: Cancel bills and Undo.

**Status:** ready-for-agent

- [ ] Dispatches, sends to a refiller, returns from a refiller and opening stock can be corrected, and all figures update
- [ ] Returns cannot be corrected, only cancelled
- [ ] Staff can correct only bills they entered today (Indian Standard Time); admins can correct any; only admins can correct opening stock
- [ ] Number and start date rules apply to corrections
- [ ] Each correction keeps the earlier version; the bill page shows an "Edited" mark and lists versions, each viewable with who changed it and when
- [ ] Lines that have allocations keep their identity through a correction
- [ ] A correction is refused if it changes the customer of a bill with allocations, removes an allocated gas, lowers a gas below its allocated quantity, or moves the date after an allocated return; the refusal links to each blocking bill
- [ ] A permitted correction, such as raising a quantity, updates pending
- [ ] A correction and a return against the same bill sent at the same moment cannot leave a bill over-returned

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
