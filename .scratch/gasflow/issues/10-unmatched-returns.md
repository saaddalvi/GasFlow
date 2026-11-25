# 10: Unmatched returns

**What to build:** cylinders returned in excess of everything pending are saved as unmatched, listed, and later matched to a bill. Covers user stories 49 to 51, 54 and 55.

**Blocked by:** 08: Receive empties.

**Status:** ready-for-agent

- [ ] Receive empties lets staff add a gas and quantity as unmatched, alone or alongside allocated rows
- [ ] Saving is refused if cylinders are left unmatched while eligible pending cylinders of that gas remain after this return's allocations
- [ ] A customer with nothing pending can be chosen and their cylinders saved as unmatched
- [ ] Unmatched cylinders count as back at the shop and reduce the customer's holding
- [ ] A list shows all unmatched returns with customer, gas, quantity, date and return number
- [ ] Any staff member can use "Match to bill" to allocate all or part of an unmatched quantity to a bill or opening stock of the same customer and gas, dated on or before the return
- [ ] Matching never exceeds the pending or unmatched quantity, including when two saves happen at once
- [ ] A customer's holding of each gas equals pending minus unmatched after returns and matching
- [ ] Unmatched cylinders may remain alongside pending ones after a missing dispatch bill is entered, until matched
