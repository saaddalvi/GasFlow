# 02: Sign in with a username

**What to build:** staff sign in with a username and password and reach a GasFlow app shell; nobody else gets in. Covers user stories 1 to 4 and 80.

The Clerk development instance is already configured as described in the spec's Clerk setup section. The Clerk secret key has to be supplied by the project owner.

**Blocked by:** 01: App skeleton and test setup.

**Status:** ready-for-agent

- [ ] Every page except sign-in requires a signed-in staff member
- [ ] The sign-in screen uses the blueprint's split layout and design system with GasFlow branding only, takes a username and password, can show or hide the password, and offers no sign-up
- [ ] The API verifies the session token on every request, answers unauthenticated requests with 401, and ignores any staff identity sent in a request body
- [ ] A local staff record is created or updated on first request, keeping the display name
- [ ] The API recognises admins from Clerk's public metadata and has one shared way to refuse admin-only actions
- [ ] There is a documented way to create the first admin, who has a recovery email
- [ ] The navigation shows the shop name, has a menu with sign out, and collapses into a usable menu on a phone
- [ ] A real account with a username, a password and no email can be created and can sign in; if it cannot, stop and report it to the project owner
- [ ] API tests cover signed-out, staff and admin requests using the identity stand-in
