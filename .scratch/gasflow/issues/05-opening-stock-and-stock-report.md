# 05: Opening stock and Stock report

**What to build:** an admin sets the start date and enters opening stock for the shop, customers and refillers, and staff see the result in the Stock report for any date. This is the first bill, so it establishes the single bill ledger that owns every change to bills. Covers user stories 11, 20 to 23, 73 and 78.

**Blocked by:** 04: Parties, gases and vehicles.

**Status:** ready-for-agent

- [ ] An admin sets the start date once during setup
- [ ] An admin enters a party's opening stock as lines of gas, fill state and quantity; suppliers are not offered
- [ ] Opening stock is always dated the start date, is numbered automatically, and is posted when saved
- [ ] A second opening stock for the same party is refused, including when two are saved at the same moment
- [ ] Staff who are not admins cannot enter opening stock
- [ ] Existing opening stock entries are listed and each can be viewed, showing who entered it and when
- [ ] Every bill change goes through one ledger module that checks rules and writes in a single database transaction
- [ ] The Stock report shows, by gas, the shop as Filled, Empty and Defective, then With customers, At refiller and Total, calculated from posted bills with no stored stock count
- [ ] Customer and refiller counts add quantities across fill states
- [ ] The report has a date picker, month-end shortcuts and previous and next day; dates before the start date show nothing
- [ ] Negative counts are shown in a red cell
- [ ] API tests enter opening stock and assert the report figures
