# 06: Dispatch bills

**What to build:** staff enter a dispatch bill from the paper copy, see it in the bill list and on its own page, and see stock change at once. Covers user stories 15, 25, 26, 29, 30, 31, 33 and 34.

**Blocked by:** 05: Opening stock and Stock report.

**Status:** ready-for-agent

- [ ] The new bill form takes paper kind, bill number, date (with the weekday spelled out), customer, optional vehicle and notes, and gas lines with fill state and quantity
- [ ] The shop is never chosen; only the customer is picked, from a searchable picker with "+ New" that adds a customer without losing the bill
- [ ] Lines can be added and removed, one line per gas can be added in one action, and Filled, Empty and Total counts update as staff type
- [ ] One "Save bill" button posts the bill; there are no drafts
- [ ] A bill number already used by a posted bill of the same paper kind is flagged while typing and refused on save, in any year, including when two staff save it at once
- [ ] The same number is accepted under the other paper kind
- [ ] A date before the start date is refused; past dates after it count on that day
- [ ] The bill list shows number, date, type, from and to, lines and status, a page at a time
- [ ] The bill page shows the details, lines and who entered it
- [ ] The Stock report reflects the dispatch; a dispatch larger than recorded shop stock is accepted and the negative count is flagged
- [ ] The form is usable on a phone
