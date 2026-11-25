# 12: Correct bills

**What to build:** staff correct a posted bill and the earlier versions stay readable, without ever contradicting recorded returns. Covers user stories 24, 56, 57, 61 and 62.

**Blocked by:** 11: Cancel bills and Undo.

**Status:** ready-for-agent

- [ ] Dispatches, sends to a refiller, returns from a refiller and opening stock can be corrected, and all figures update
- [ ] Returns cannot be corrected, only cancelled
- [ ] Staff can correct only bills they entered today (Indian Standard Time); admins can correct any; only admins can correct opening stock
- [ ] Number and start date rules apply to corrections
- [ ] Each correction keeps the earlier version; the bill page shows an "Edited" mark and lists versions, each viewable with who changed it and when
- [ ] Lines that have allocations keep their identity through a correction
- [ ] A correction is refused if it changes the customer of a bill with allocations, removes an allocated gas, lowers a gas below its allocated quantity, or moves the date after an allocated return; the refusal links to each blocking bill
- [ ] A permitted correction, such as raising a quantity, updates pending
- [ ] A correction and a return against the same bill sent at the same moment cannot leave a bill over-returned
