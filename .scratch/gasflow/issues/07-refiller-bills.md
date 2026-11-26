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
