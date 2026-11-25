# 17: Customer and refiller pages

**What to build:** the party list and each party's page give the full picture of what that party holds. Covers user stories 18, 39, 66, 67 and 69.

**Blocked by:** 10: Unmatched returns; 11: Cancel bills and Undo; 16: Overdue and pending returns. (Ticket 07 is covered through 11.)

**Status:** ready-for-agent

- [ ] The party list shows summary figures (active parties by type, with customers, at refillers, below zero) and, per party, the holding now and last bill
- [ ] A party's page shows its holding by gas, this month's sent, returned and net out, its bills (active, cancelled or all) and a daily summary, with a date range picker
- [ ] A customer's page lists pending bills with days out, highlights overdue ones and shows any unmatched returns
- [ ] Receive empties opens from a customer's page with that customer chosen
- [ ] Deactivating a party that holds cylinders, including a negative holding, or has unmatched returns is refused with the reason
- [ ] A party with nothing held and nothing unmatched can be deactivated, and its history stays readable
