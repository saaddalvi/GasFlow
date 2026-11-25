# 15: Find bills

**What to build:** staff find any bill with filters and spot dispatches that still have cylinders pending. Covers user stories 64 and 65.

**Blocked by:** 07: Refiller bills; 08: Receive empties.

**Status:** ready-for-agent

- [ ] The bill list filters by bill number, slip number, paper kind, type, party name and date range, alone or combined, with a reset
- [ ] The total number of matching bills is shown
- [ ] Dispatch bills show how much has been returned, such as `3 / 5`
- [ ] A pending returns filter shows only dispatch bills with cylinders pending
- [ ] Filtering and paging happen in the API
- [ ] Bills sharing a number across paper kinds or refillers can be told apart by type, date and party
