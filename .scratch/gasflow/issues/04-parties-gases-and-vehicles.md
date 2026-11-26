# 04: Parties, gases and vehicles

**What to build:** staff maintain customers, refillers, suppliers and vehicles, and admins maintain the gas list. Covers user stories 13, 14, 16, 17 and 19.

**Blocked by:** 02: Sign in with a username.

**Status:** ready-for-agent

- [x] Staff can add, view and edit a customer, refiller or supplier with name (required), abbreviation (derived from the name if left blank), mobile, contact person, address, notes and active flag
- [x] The shop cannot be added, deactivated or deleted, and warehouse is not a party type
- [x] The party list can be searched by name, filtered by type, and shows inactive parties on request
- [x] A party can be deactivated and then no longer appears in pickers (the block for parties with open matters comes in ticket 17)
- [x] Staff can add and edit vehicles with plate, label and active flag
- [x] Admins can add, rename and retire gases; retired gases are no longer offered on new entries; staff cannot change gases
- [x] The forms and the API validate with the same shared schemas

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

**26 November 2026: checked in the running local app, signed in through Clerk as an admin.** A script drove a headless Chromium browser against the development instance and database, at the code in `4166252`. All 70 checks passed. The one browser error was the expected "not found" for a party that does not exist.

- Sign-in and sign-out, and signed-out visits being sent to sign in.
- Gases: add, rename, retire and bring back; duplicate and blank names refused; a retired gas is not offered.
- Parties: add a customer, refiller and supplier; automatic abbreviations; edit, deactivate and make active; search and type filter; refusals; the shop cannot be changed and "warehouse" is refused.
- Vehicles: add as active or inactive, edit and make active; a blank plate refused.
- Saving a party or vehicle edit kept a change made through the API while the form was open.
- Staff screen, whose shared parts this ticket changed: the list loads, a password can be shown and hidden, the password and recovery email boxes open, and a taken username and a short password are refused. No account was added or changed.
- No sideways page scroll at phone or tablet width on the gases, parties, add party, party, edit party, vehicles and staff pages.
- After a refusal from the server, the button reads "Saving…" for about a second longer while the page reloads. It does not stick.

The test parties, vehicles and gas were then deleted from the development database, as the app cannot delete them.

Still to do:

- Sign in as a staff member who is not an admin. Check that they can add and edit parties and vehicles, that the Gases page offers no changes and that there is no Staff screen.
- Check by hand in the browsers and on the phones the agency will use. Safari, Firefox, a real phone and a production build have not been tried.

**26 November 2026: completed** in commit `4166252`. It is pushed, and [CI passed](https://github.com/saaddalvi/GasFlow/actions/runs/45782307416) at `e7d3fd8`.

- The project owner asked for every criterion to be ticked and the ticket to be marked completed. No results of the checks under the last "Still to do" were recorded here.
- The decisions listed for the project owner are not recorded as settled.
