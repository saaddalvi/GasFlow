# 09: Fill oldest first

**What to build:** on Receive empties, staff type one total for a gas and the app proposes how to split it across the oldest bills, which staff can adjust before saving. Covers user story 44.

**Blocked by:** 08: Receive empties.

**Status:** ready-for-agent

- [ ] The API proposes the split and the screen only displays it
- [ ] The total fills the oldest eligible bills of that gas first, including opening stock
- [ ] Only bills dated on or before the return date are used, and changing the date updates the proposal
- [ ] The proposed quantities appear in the rows and can be edited before saving
- [ ] A total larger than eligible pending fills all of it and shows the excess; it is not silently dropped
- [ ] Proposing a split saves nothing
- [ ] API tests cover ordering, ties on the same date, the date limit and the excess
