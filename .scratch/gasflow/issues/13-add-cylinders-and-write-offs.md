# 13: Add cylinders and write-offs

**What to build:** an admin records cylinders joining the business and writes off scrapped or lost cylinders from the shop or a refiller. Covers user stories 35 and 36.

**Blocked by:** 12: Correct bills.

**Status:** ready-for-agent

- [x] An admin can record add cylinders to the shop with gas lines, fill states and an optional supplier
- [x] An admin can write off from the shop or a refiller with gas lines and a required reason (scrapped or lost, with notes)
- [x] Both are numbered automatically, with a different prefix for each kind
- [x] Staff who are not admins cannot create, correct or cancel them
- [x] An admin can correct and cancel both, with revision history
- [x] The Stock report totals rise and fall accordingly
- [x] Neither a supplier nor the outside side of these bills ever appears as a holding, in totals or as a negative count
- [x] The bill list and bill page show both kinds correctly

## Comments

**27 November 2026: built in commit `515afcd`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. Run `pnpm db:migrate` first; every screen that shows bills needs the new column.

- As admin, add cylinders with and without a supplier, and write off from the shop and from a refiller. Correct one of each and cancel one of each, and see the Stock report follow.
- As staff, see that **New bill** offers neither type, and that those bills offer no **Correct bill** or **Cancel bill**.
- Enter a write-off on a real phone.

How it works:

- Both are entered with `POST /api/bills` and corrected with `PUT /api/bills/:billId`. Add cylinders takes `{ type: "add_cylinders", supplierId, date, notes, lines }`, where `supplierId` may be left out. A write-off takes `{ type: "write_off", refillerId, writeOffReason, date, notes, lines }`, where `refillerId` must be sent and is null for the shop.
- A bill now has `writeOffReason`, which is null on every other type. Versions saved before this load with null.
- On add cylinders, `from` is the supplier or null and `to` is the shop. On a write-off, `from` is the shop or refiller and `to` is null. The Stock report counts only the shop, customers and refillers, so it did not change.
- Who may enter a type is `whyNotEnter` in `packages/shared/src/bill.ts`, used by the API and the form. Who may correct or cancel is `whyNotCancel` and `whyNotCorrect`, as before.
- The screens are the existing ones: the new bill form, the bill list, the bill page and the correction page.

Checked:

- `pnpm check` passes, with 560 tests, and `pnpm build` passes.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a clone of the development database, which held no bills. Nothing was run against Clerk. As admin: both types were entered, including a supplier added from within the bill, one of each was corrected and a write-off was cancelled. As staff, neither type was offered, and neither was correcting or cancelling. A version saved without the reason field still loaded, tried by removing the field from one in the clone.
- No sideways scrolling at 320, 390, 768 and 1280 wide on the new bill form (both types), the bill list, the write-off's bill page and correction page, and an add cylinders bill page.
- The code review found that a correction accepted the shop as the supplier of a bill naming none, which would have lowered the totals. Fixed, with a test. The review's fixes and a change in the order of the write-off fields came after the width check. Entering both types was tried again afterwards; widths were not.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- The numbers are `ADD-20261127-001` and `WOF-20261127-001`. The spec leaves the prefixes to be supplied.
- A write-off needs a reason, scrapped or lost. Notes are optional. Say if "with notes" meant they are required.
- A new line starts as Empty on add cylinders and as Defective on a write-off. Both can be changed. A filled cylinder lost at the shop and saved as Defective would lower the wrong count.
- Neither records a vehicle.
- Correcting the date keeps the number, which still shows the date first entered.
- As on other bills, an inactive supplier or refiller cannot be newly named. To write off an inactive refiller's cylinders, make it active first.

For later tickets:

- Ticket 14: `newWriteOffSchema` and the form's **Written off from** know only the shop and refillers, and the API refuses a customer with "A write-off is from the shop or a refiller." The database already allows a write-off from a customer. `whyUncorrectable` sees only the type and status, so it will need to know whom a write-off is from; until it refuses a customer's, the correction form would treat one as the shop's.
- Tickets 18, 20 and 21: one side of these bills is null or a supplier. Count only what the shop, customers and refillers gain and lose.

**27 November 2026: checks run in Chrome. All passed. A real phone is still to do.**

Run in headless Chrome through the Playwright MCP against commit `515afcd` (the code at `90dbfa2`), signed in with real Clerk development accounts (`admin` and `test1`). The app and the database were copies, and the figures were made up. The start date, a refiller, a supplier and opening stock were created through the API; everything below was done on screen unless it says otherwise.

- **Adding cylinders: passed**, with a supplier chosen from the list, with none, and with one added from within the bill. A name typed but not chosen held the form back.
- **Writing off: passed** from the shop and from a refiller. Saving without a reason, or without the refiller, was refused.
- **Correcting: passed.** An add cylinders bill and a shop write-off each started their form with what they said, showed **Edited** and kept the earlier version. A write-off was also moved from a refiller to the shop.
- **Cancelling: passed** for one of each. Each was confirmed first, showed who, when and why, and then offered neither correcting nor cancelling.
- **Stock report: passed.** After each of the eight entries, corrections and cancellations the figures were as worked out by hand beforehand, and again after the three bills on the emulated phone taken together. No supplier appeared and no count went below zero.
- **Staff: passed.** **New bill** offered neither type. Neither bill offered **Correct bill** or **Cancel bill**, and each correction page said why. The API refused entering, correcting and cancelling both types, asked directly, and nothing changed.
- **Widths: passed.** No sideways scrolling at 320, 390, 768 and 1280 on the new bill form (both types, and with the supplier or refiller list open), the bill list, the corrected and cancelled bills of both types with their versions open, both correction pages and the Stock report.
- **On a phone: passed on an emulated phone** (touch, 390 wide). A write-off from a refiller was entered and corrected, and cylinders were added from a new supplier.

No page errors were raised, and the API answered no request with a server error. The one console error was a missing `favicon.ico`.

Still to do: enter a write-off on a real phone. Safari and Firefox have not been tried.

**27 November 2026: completed** in commit `515afcd`.

- The project owner asked for the boxes to be ticked and the ticket marked complete. No check on a real phone is recorded here. The phone check was on the emulated phone described above.
- `pnpm check`, with 560 tests, and `pnpm build` passed on the code committed in `515afcd`, which has not changed since.
- The decisions listed for the project owner are not recorded as settled.
