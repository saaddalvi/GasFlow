# 02: Sign in with a username

**What to build:** staff sign in with a username and password and reach a GasFlow app shell; nobody else gets in. Covers user stories 1 to 4 and 80.

The Clerk development instance is already configured as described in the spec's Clerk setup section. The Clerk secret key has to be supplied by the project owner.

**Blocked by:** 01: App skeleton and test setup.

**Status:** needs-info

- [x] Every page except sign-in requires a signed-in staff member
- [ ] The sign-in screen uses the blueprint's split layout and design system with GasFlow branding only, takes a username and password, can show or hide the password, and offers no sign-up
- [x] The API verifies the session token on every request, answers unauthenticated requests with 401, and ignores any staff identity sent in a request body
- [x] A local staff record is created or updated on first request, keeping the display name
- [x] The API recognises admins from Clerk's public metadata and has one shared way to refuse admin-only actions
- [x] There is a documented way to create the first admin, who has a recovery email
- [ ] The navigation shows the shop name, has a menu with sign out, and collapses into a usable menu on a phone
- [ ] A real account with a username, a password and no email can be created and can sign in; if it cannot, stop and report it to the project owner
- [x] API tests cover signed-out, staff and admin requests using the identity stand-in

## Comments

**26 November 2026: built, waiting on a check with real accounts.**

Creating test accounts in the Clerk development instance with the secret key was blocked by the coding agent's permission check, and the instance had no accounts. No one has signed in yet.

Still to do, with a staff account that has a username, a password and no email, and an admin account made by following the README:

- Create both accounts and sign in with each. If the account without an email cannot be created or cannot sign in, stop and tell the project owner.
- On the password step, show and hide the password.
- Check the app shell: shop name, staff name, sign out, and the menu on a phone-sized screen.
- Check that the API accepts the real session token, records the staff member's name and reads the admin role.
- As the admin, reset the password through the recovery email.

Checked so far:

- API tests pass using the identity stand-in. The real Clerk adapter has only been seen to refuse bad tokens.
- In a headless browser, signed-out visits go to `/sign-in`, there is no sign-up link, and the sign-in screen fits desktop and phone widths.

For the project owner to decide:

- Sign-in uses Clerk's component, as the blueprint says, so it asks for the username first and the password next. Its card shows "Secured by Clerk".
- The desktop user menu includes Clerk's "Manage account", where staff can change their own name, which bills will show. Check whether Clerk also lets them delete their account.
- The picture of six cylinders is a drawing; there is no photo.
