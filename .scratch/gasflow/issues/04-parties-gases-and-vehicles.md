# 04: Parties, gases and vehicles

**What to build:** staff maintain customers, refillers, suppliers and vehicles, and admins maintain the gas list. Covers user stories 13, 14, 16, 17 and 19.

**Blocked by:** 02: Sign in with a username.

**Status:** ready-for-agent

- [ ] Staff can add, view and edit a customer, refiller or supplier with name (required), abbreviation (derived from the name if left blank), mobile, contact person, address, notes and active flag
- [ ] The shop cannot be added, deactivated or deleted, and warehouse is not a party type
- [ ] The party list can be searched by name, filtered by type, and shows inactive parties on request
- [ ] A party can be deactivated and then no longer appears in pickers (the block for parties with open matters comes in ticket 17)
- [ ] Staff can add and edit vehicles with plate, label and active flag
- [ ] Admins can add, rename and retire gases; retired gases are no longer offered on new entries; staff cannot change gases
- [ ] The forms and the API validate with the same shared schemas
