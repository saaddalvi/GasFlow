# 14: Customer write-offs

**What to build:** an admin writes off a customer's lost cylinders against a chosen bill, so they stop showing as pending. Covers user stories 37, 59 and 63.

**Blocked by:** 13: Add cylinders and write-offs.

**Status:** ready-for-agent

- [ ] An admin chooses a customer, then a dispatch bill or opening stock with pending cylinders, a gas, a quantity, a date and a reason
- [ ] The quantity is limited to that bill's pending cylinders, the date cannot be before the bill's, and a customer write-off is never unmatched
- [ ] Pending and the customer's holding fall, the shop is unchanged, and the business total falls
- [ ] The dispatch bill page shows sent, returned, written off and pending, lists each write-off, and counts write-offs towards its tag
- [ ] A customer write-off cannot be corrected, only cancelled and entered again; cancelling restores pending
- [ ] A dispatch bill or opening stock with a write-off is protected from cancellation and contradicting corrections, like one with returns
- [ ] A write-off and a return against the same pending cylinders sent at the same moment cannot both over-clear the bill
- [ ] A customer's holding of each gas still equals pending minus unmatched
