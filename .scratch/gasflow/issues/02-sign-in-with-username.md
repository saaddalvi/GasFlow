# 02: Sign in with a username

**What to build:** staff sign in with a username and password and reach a GasFlow app shell; nobody else gets in. Covers user stories 1 to 4 and 80.

The Clerk development instance is already configured as described in the spec's Clerk setup section. The Clerk secret key has to be supplied by the project owner.

**Blocked by:** 01: App skeleton and test setup.

**Status:** ready-for-agent

- [x] Every page except sign-in requires a signed-in staff member
- [x] The sign-in screen uses the blueprint's split layout and design system with GasFlow branding only, takes a username and password, can show or hide the password, and offers no sign-up
- [x] The API verifies the session token on every request, answers unauthenticated requests with 401, and ignores any staff identity sent in a request body
- [x] A local staff record is created or updated on first request, keeping the display name
- [x] The API recognises admins from Clerk's public metadata and has one shared way to refuse admin-only actions
- [x] There is a documented way to create the first admin, who has a recovery email
- [x] The navigation shows the shop name, has a menu with sign out, and collapses into a usable menu on a phone
- [x] A real account with a username, a password and no email can be created and can sign in; if it cannot, stop and report it to the project owner
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
- The user menu now offers only sign out; "Manage account" was removed on the project owner's request. The development instance still lets signed-in people delete their own account through Clerk (`delete_self`), and has not been checked for name changes. Decide whether to turn these off in Clerk.
- The picture of six cylinders is a drawing; there is no photo.

**26 November 2026: first real sign-in.** The project owner created an account in the development instance with a username, a password and no email, and signed in.

- Clerk shows the account with no email address and a completed sign-in.
- The app listed the gases and showed the staff member's name, so the API accepted the real session token. The local staff record holds that name.

Still to check: showing and hiding the password, the new sign-out menu, the menu on a phone-sized screen, and everything about admins (reading the role, and password recovery by email).

**26 November 2026: admin account.** The project owner made an admin in the development instance. The API reported it as an admin from a real session token, and it now has a verified recovery email, not yet marked primary.

Still to check: showing and hiding the password, the new sign-out menu, the menu on a phone-sized screen, and password recovery by email.

**26 November 2026: completed** in commits `cc3e000` and `227051d`. They are not pushed, so CI has not run on them.

- The project owner checked by hand and reported as working: showing and hiding the password, password recovery by email, the sign-out menu, and the menu on a narrow window.
- Clerk still showed the admin's password as unchanged since the account was created. Before relying on recovery, confirm that it ends with a new password being set. The recovery email was not marked primary when last read.
- Clerk's logs flagged the development admin's password as found in a known leak. Use a different one, above all in production.
- The decisions listed for the project owner in the first comment, as since updated, are still open.
- For ticket 03: the API cannot yet create accounts, reset passwords or remove access.
