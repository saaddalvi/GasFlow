# 22: Offline backup

**What to build:** staff download one file that answers who holds what when there is no internet. Covers user story 79.

**Blocked by:** 07: Refiller bills; 08: Receive empties.

**Status:** ready-for-agent

- [ ] A signed-in staff member can download a single HTML file from the menu
- [ ] The file contains every party's current holdings, the shop's stock and the last 60 days of bills
- [ ] It has inline styles and no external dependencies, and opens with no internet
- [ ] It shows a note stating when it was generated
- [ ] Party names and notes cannot inject markup or scripts into the file
- [ ] Signed-out requests are refused
- [ ] API tests check the contents, including the 60-day boundary
