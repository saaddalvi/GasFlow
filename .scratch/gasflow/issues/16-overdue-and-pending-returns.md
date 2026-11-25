# 16: Overdue and pending returns

**What to build:** staff see which cylinders have been out longest and which are overdue. Covers user stories 68 to 70.

**Blocked by:** 08: Receive empties.

**Status:** ready-for-agent

- [ ] A pending returns list shows every pending bill and gas with customer, bill date, quantity and days out, longest first, a page at a time
- [ ] Opening stock appears in it, with days out counted from the start date
- [ ] The overdue limit starts at 30 days and only an admin can change it
- [ ] Cylinders are overdue when days out exceed the limit; tests cover the day on the limit and the day after
- [ ] Overdue rows are highlighted on the pending returns list and on Receive empties
- [ ] Changing the limit updates the highlighting at once
- [ ] Each row links to its bill and to Receive empties for that customer
