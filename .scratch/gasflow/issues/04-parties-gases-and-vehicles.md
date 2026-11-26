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

## Comments

**26 November 2026: built in commit `4166252`, waiting on a check by hand.** Not pushed, so CI has not run on it.

Still to do, signed in with real accounts:

- As staff, add a customer, refiller and supplier. Leave one abbreviation blank. Edit one, deactivate it, find it with "Show inactive" and make it active again. Search by name and filter by type.
- Add a vehicle, edit it and make it inactive.
- As an admin, add, rename, retire and bring back a gas. As staff, check that the Gases page offers no changes.

Checked so far:

- API tests cover parties, vehicles and gases, including the staff and admin permissions.
- The screens were driven in a headless browser at desktop and phone widths, in a throwaway copy of the app with sign-in replaced by the identity stand-in and its own database. Nothing was run against Clerk.

For the project owner to decide:

- A party keeps the type it was added with, so that later bills cannot be contradicted. A party added under the wrong type has to be deactivated and added again.
- A blank abbreviation becomes the first letters of up to five words ("Sharma Gas Agency" gives SGA), or the first three letters of a one-word name. Parties may share one ("Zeta 01" and "Zeta 02" both give Z0).
- Two parties may have the same name, and two vehicles the same plate.
- A retired gas can be brought back. Until then it still holds its name.
- Longest entries accepted: party name 100, abbreviation 10, mobile 30, contact person 100, address 500, notes 1,000, number plate 20, vehicle label 100, gas name 50 characters.
- Gases are managed on the home page, which ticket 21 turns into the dashboard.
- The glossary has no entry for vehicle, abbreviation, inactive or retired.

For later tickets:

- Parties, vehicles and gases are listed without inactive or retired ones unless asked. New entries must also refuse one named directly in a request.
- The database needs the `citext` extension, which the migrations create. Confirm this works on Neon at go-live.
