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
