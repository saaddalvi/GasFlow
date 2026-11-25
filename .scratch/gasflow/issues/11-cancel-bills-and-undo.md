# 11: Cancel bills and Undo

**What to build:** staff cancel mistaken bills under the permission rules, bills with returns are protected, and a new return can be undone in one tap. Covers user stories 32, 53, 56 to 58, 60 and 61.

**Blocked by:** 07: Refiller bills; 08: Receive empties.

**Status:** ready-for-agent

- [ ] Cancelling needs a reason (data entry error, duplicate entry, customer rejected, wrong cylinder loaded, bill voided or other), takes optional notes, and is confirmed first
- [ ] A cancelled bill cannot be restored, stays visible with who cancelled it, when and why, and has no effect on any figure
- [ ] The bill list can filter by posted or cancelled
- [ ] A cancelled bill's number can be used again
- [ ] Staff can cancel only bills they entered today (Indian Standard Time); admins can cancel any; only admins can cancel opening stock
- [ ] After opening stock is cancelled, a new one can be entered for that party
- [ ] Cancelling a return restores pending on the bills it was allocated to
- [ ] A dispatch bill or opening stock with allocations cannot be cancelled, and the refusal links to each blocking bill
- [ ] A cancellation and a return against the same bill sent at the same moment cannot both succeed
- [ ] After saving Receive empties, an Undo shown for about 10 seconds cancels that return with the reason data entry error
