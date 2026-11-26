# 07: Refiller bills

**What to build:** staff send cylinders to a refiller and record them coming back. Covers user stories 27 and 28.

**Blocked by:** 06: Dispatch bills.

**Status:** ready-for-agent

- [x] The new bill form offers Send to refiller and Return from refiller, with a single Refiller picker whose label follows the type
- [x] A send to refiller defaults its lines to empty, and a return from refiller to filled; both can be changed
- [x] A send to refiller takes a paper kind and number, unique forever within that paper kind across dispatches and sends to a refiller together
- [x] A return from refiller takes the refiller's slip number, which must be unique for that refiller only
- [x] The customer return type is not offered in this form, and the API refuses it here
- [x] The Stock report moves cylinders between the shop's fill states and the refiller's count
- [x] A refiller returning more than was sent is accepted and the negative count is flagged
- [x] API tests cover both number rules and the stock effect

## Comments

**26 November 2026: built in commit `461d9dd`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first; refiller bills cannot be saved until then.

- Enter a send to a refiller and a return from that refiller from paper copies, then check **Bills** and the Stock report.
- Add a refiller with **+ New** halfway through a bill.
- Type a used number on a send, and a used slip number on a return from refiller.
- Enter and save a refiller bill on a real phone.

Checked so far:

- `pnpm check` (297 tests) passes. A production build passed on a copy of the app, before the last fixes from review.
- The screens were driven in a headless Chromium browser, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. The return from refiller form was checked for overflow at 320, 375, 768 and 1280 wide, and the send form at 320. Nothing was run against Clerk. Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- **A negative refiller count is flagged only on the total for all refillers.** If one refiller is at -3 and another holds 10 of the same gas, the Stock report shows 7 and flags nothing. Counts for each refiller arrive with tickets 17 and 19.
- The single party picker is labelled **Customer** or **Refiller** by the type, as the blueprint describes.
- Slip numbers follow the same rules as bill numbers: capitals and surrounding spaces are ignored, and a number takes at most 30 characters. A slip number stays taken in any year.
- A line whose fill state has not been chosen follows the type when the type is changed. A chosen one stays.
- A paper bill number and a refiller's slip number are typed separately, so changing the type does not carry one to the other.

Known limits:

- That a cancelled bill frees its number (story 32) is set up in the database for both kinds of number but cannot be tested until ticket 11.

For later tickets:

- Ticket 08: the optional slip number on a customer return is the glossary's "Slip number" and needs its own field. Names beginning `refillerSlipNumber` refer to the bill number of a return from refiller.
- Ticket 12: both number warnings have to leave out the bill being corrected. A correction has to keep the rules in `NAMED_PARTY` in the ledger.
- Tickets 12 and 13: a form line has no fill state until one is chosen, so `LineList` and `asNewLines` take the default.

**26 November 2026: completed** in commit `461d9dd`. It is pushed; the CI result has not been checked.

- The project owner asked for the ticket to be marked completed. No results of the checks under "Still to do", signed in with real accounts or on a real phone, are recorded here.
- The two new migrations had not been applied to the development database when this was written. Run `pnpm db:migrate` before using refiller bills there.
- The decisions listed for the project owner are not recorded as settled.

**26 November 2026: checks run in a browser. All passed except the real phone, which is still to do.**

Run in headless Chrome through the Playwright MCP, signed in with real Clerk development accounts: an admin set the start date and the shop's opening stock, and a staff account entered the refiller bills. The app and the development database were copies, and the figures were made up, not taken from paper copies.

- **A send and a return, then Bills and the Stock report: passed.** The shop started with 20 filled and 15 empty medical oxygen. After sending 12 empty (S-101) and receiving 9 filled (R-501), **Bills** listed both with the right from and to, and the Stock report showed 29 filled, 3 empty, 3 at the refiller and a total of 35.
- **+ New halfway through a bill: passed.** The new refiller was selected, and the type, paper kind, bill number, line and notes stayed as typed.
- **Used numbers: passed.** A send with S-101 and a return from refiller with R-501 each showed a warning with a link to the earlier bill while typing, and saving was refused. S-101 typed in lower case with spaces around it was warned about too.
- **A real phone: still to do.** As a stand-in, Chrome emulated a phone 390 wide with touch. A send (S-102) saved, the Stock report then showed 1 empty, 5 at the refiller and a total of 35, and neither the form nor the saved bill scrolled sideways. A real keyboard and Safari have not been tried.

Found during the checks, not changed:

- After a refused save, the message above **Save bill** stays until the next save. With the paper kind changed to Cash memo it still read "Bill number S-101 is already in use.", although the warning under the number had cleared. This comes from the form component that screens share (`ActionForm`), which is older than this ticket.
