# 11: Cancel bills and Undo

**What to build:** staff cancel mistaken bills under the permission rules, bills with returns are protected, and a new return can be undone in one tap. Covers user stories 32, 53, 56 to 58, 60 and 61.

**Blocked by:** 07: Refiller bills; 08: Receive empties.

**Status:** ready-for-agent

- [ ] Cancelling needs a reason (data entry error, duplicate entry, customer rejected, wrong cylinder loaded, bill voided or other), takes optional notes, and is confirmed first
- [ ] A cancelled bill cannot be restored, stays visible with who cancelled it, when and why, and has no effect on any figure
- [ ] The bill list can filter by posted or cancelled
- [ ] A cancelled bill's number can be used again
- [ ] Staff can cancel only bills they entered today (Indian Standard Time); admins can cancel any; only admins can cancel opening stock
- [ ] After opening stock is cancelled, a new one can be entered for that party
- [ ] Cancelling a return restores pending on the bills it was allocated to
- [ ] A dispatch bill or opening stock with allocations cannot be cancelled, and the refusal links to each blocking bill
- [ ] A cancellation and a return against the same bill sent at the same moment cannot both succeed
- [ ] After saving Receive empties, an Undo shown for about 10 seconds cancels that return with the reason data entry error

## Comments

**26 November 2026: built in commit `888c307`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first; the bill pages and the bill list need the new migration.

- As staff, cancel a bill entered today, and see that an older one and a colleague's offer no **Cancel bill**.
- As an admin, cancel opening stock and enter it again.
- Receive empties on a real phone, then **Undo**.

How it works:

- `POST /api/bills/:billId/cancel` takes `{ reason, notes }` and answers the bill, which now has `cancellation`.
- `cancelBill` in `apps/api/src/services/ledger.ts` locks the party, then checks permission, status and what is matched to the bill.
- A refusal because returns are matched to the bill carries `blockingBills: [{ id, number }]`.
- Who may cancel is `whyNotCancel` in `packages/shared/src/bill.ts`, used by the API and the bill page.
- `GET /api/bills` takes `status=posted` or `status=cancelled`.
- **Undo** cancels through the same route, with the reason data entry error.

Checked:

- `pnpm check` passes, with 454 tests.
- The three tests of saves at the same moment (cancel with a return, with a match, and with another cancel) fail when the lock is taken out of cancelling.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database, signed in as staff. Nothing was run against Clerk. The bill list, a cancelled bill, the confirmation box and Undo had no sideways scrolling at 320, 768 and 1280 wide. The admin's view, opening stock, Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- A cancelled bill's typed number, or refiller's slip number, can be used again. Numbers the app issues, such as `RET-…` and `OPN-…`, are not issued again.
- The confirmation on Receive empties now stays until the next return is saved, so that choosing another customer does not take Undo away. It used to go when a customer was chosen.
- **Cancel bill** is offered on a dispatch bill that has returns. The refusal, with its links, comes after confirming.

Known limits:

- Only the last return saved has Undo. Saving another within 10 seconds replaces it.
- Staff who save a return just before midnight in India cannot undo it after midnight.

For later tickets:

- Ticket 12: corrections have the same permission rule as `whyNotCancel`. `cancelBill` reads the bill's parties before locking one, which is safe only while a bill's parties never change. A correction that changes the customer has to allow for that.
- Ticket 14: `refuseWhileReturnedAgainst` and its message speak of returns only, and would name a write-off as one.
- Ticket 17: cancelling is allowed for an inactive party, which can leave one holding cylinders.
