# 21: Dashboard

**What to build:** the first screen shows today's activity and where every cylinder is. Follows the blueprint's dashboard layout, without anything from Insights. Covers user stories 71, 72 and 78.

**Blocked by:** 13: Add cylinders and write-offs; 15: Find bills; 16: Overdue and pending returns.

**Status:** ready-for-agent

- [x] Today shows "Dispatched today" (with comparison to the same weekday last week, customer count, gas breakdown, 7-day strip and month to date against last month), received from customers, net out, bills entered with the last entry time, and refiller movements
- [x] Cylinder cards show the total, shop stock by fill state, with customers and at refillers
- [x] A pending returns card shows total pending cylinders, number of customers and how many are overdue, and links to the list
- [x] A counts below zero card shows how many are at the shop and how many are with parties
- [x] Quick actions include New bill, Receive empties, Bills, Stock, Parties, Day ledger, Balance register and, for admins, Opening stock
- [x] Figures link to the matching filtered list
- [x] Opening stock is not counted as today's movement
- [x] Labels use glossary terms, and the page works on a phone

## Comments

**27 November 2026: built in commit `6b5a4c9`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts. No migration is new.

- Sign in and check that the dashboard opens first. Compare **Dispatched today**, **Received from customers**, **Bills entered** and the refiller figures with the day's paper.
- Compare **Your cylinders** with **Stock** for today.
- Follow each figure to its list, including the 7-day strip, **Month to date**, **Pending returns** and both counts below zero.
- As admin, see **Opening stock** under **Quick actions**; as staff, see that it is not offered.
- Open **Gases**, which has moved, and add or rename one.
- Look at the dashboard on a real phone.

How it works:

- `GET /api/dashboard` answers `{ date, startDate, dispatched, received, netOut, billsEntered, refillerMovements, cylinders, pendingReturns, belowZero }`. `date` is today in India.
- `dispatched` has `quantity`, `customers`, `gases`, `lastWeek`, seven `days` ending today, `thisMonth` and `lastMonth`. `lastMonth` runs to the same day of the month, or to its last day if it has no such day.
- Movement counts posted bills by their own dates. Opening stock, write-offs and added cylinders are not movement.
- `cylinders` adds up the stock report for today, and counts the customers and refillers holding any.
- `pendingReturns` adds up everything on the pending returns list: cylinders, customers and overdue cylinders.
- `belowZero.shop` has one count for each gas and fill state below zero, and `belowZero.parties` one for each party and gas.
- Two filters are new, so that figures have a list to open. The bill list takes `enteredOn`, shown as **Entered on**. The balance register takes `show=below_zero`, shown as **Below zero**.
- The dashboard is at `/`. The gases list moved to `/gases`, and the top menu has both.
- Gas counts are not links of their own, as no list narrows by gas. Those inside a card open the card's list. **Net out today** is not a link.

Checked:

- `pnpm check`, with 814 tests, and `pnpm build` passed on the code committed.
- The screens were driven with the Playwright MCP in headless Chrome, in a throwaway copy of the app with sign-in replaced by the identity stand-in, on a new database with made-up figures. Nothing was run against Clerk or the development database.
- Tried before the review: every link on the dashboard and the filters its list opened with, the staff view, the **Entered on** and **Below zero** filters from their screens, a strip bar by keyboard, a day with no bills, no start date, and figures that could not be loaded.
- Out of the code review came: **Pending returns** and **Counts below zero** moved up into **Today**, as the blueprint has it; refillers on one line; **Net out today** taken out of the returns link; days before the start date shown as a dash in the strip; words under the count below zero; and some names. After those changes there was no sideways scrolling at 320, 390, 640, 768, 1024 and 1280 wide, all 30 links opened without an error, and the strip was checked with a start date four days back. A last change to the spacing was seen only at 390 wide.
- Safari, Firefox and a real phone have not been tried.

For the project owner to decide:

- **Bills entered** counts posted bills entered today, whatever their dates, opening stock among them. Opening stock still counts in no movement.
- Counts below zero are counted gas by gas, so "3 with parties" can open a register of 2 parties.
- **Pending returns** includes bills dated after today, as its list does. **Your cylinders** stops at today, so the two can differ.
- The overdue figure is of cylinders, not customers.

