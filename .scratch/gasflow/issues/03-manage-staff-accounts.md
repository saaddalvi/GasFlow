# 03: Manage staff accounts

**What to build:** an admin runs staff access from a Staff screen, with no email invitations. Covers user stories 5 to 10.

**Blocked by:** 02: Sign in with a username.

**Status:** ready-for-agent

- [x] An admin can create an account with a name, username and starting password, and that person can then sign in
- [x] Clerk's refusals (username taken or too short, password under 8 characters) are shown as clear messages
- [x] An admin can set a new password for any staff member
- [x] An admin can remove a staff member's access; that person can no longer use the app, and their staff record and name are kept
- [x] An admin can make a staff member an admin or remove the role
- [x] Every admin has a recovery email, required when the role is granted
- [x] Staff who are not admins cannot see the Staff screen, and the API refuses their requests
- [x] API tests cover each action as staff and as admin

## Comments

**26 November 2026: built in commit `5c2b306`, waiting on a check with real accounts.** Pushed, and [CI passed](https://github.com/saaddalvi/GasFlow/actions/runs/45777137984) at `d41b4f2`.

Still to do in the development instance, signed in as the admin, using test accounts:

- Add a staff member on the Staff screen and sign in as them in a private window. Check that their name shows.
- Try a taken username, a username under 4 characters and a password under 8 characters. Each should show a clear message. A common password such as `password123` should be accepted.
- Set a new password for someone who is signed in. The old one should stop working, and they should be signed out within about a minute. Then set your own and sign in again.
- Remove a signed-in person's access. They should be locked out and unable to sign in, with their name listed under "Access removed".
- Make someone an admin. In the Clerk dashboard the recovery email should be verified and primary, and the person should see the Staff screen. Change the email; the old address should be gone. Reset their password by email and sign in with the new one.
- Remove that admin role. The role and the email should both be gone in Clerk.

Checked so far:

- API tests cover every action as staff and as admin, using the identity stand-in.
- The real Clerk adapter was run against a faked Clerk API: the requests it sends, and its messages for the error codes in Clerk's documentation. It has not been run successfully against Clerk. One request from a mistake in that check reached Clerk with a made-up key and was refused.
- The Staff screen was driven in a headless browser against the identity stand-in, at desktop and phone widths. A staff member who is not an admin saw no Staff link and got "not found" at `/staff`.

For the project owner to decide:

- Admins cannot remove their own access or admin role. Two admins removing each other at the same moment could still leave none; the Clerk dashboard can then restore one.
- Removing access deletes the Clerk account for good. Banning it instead would allow it to be restored, but would keep the username taken.
- A recovery email is trusted without sending a code to it, so a mistyped address could let a stranger reset that admin's password. Saving an address removes any other on the account, and removing the admin role removes them all.
- An admin made in the Clerk dashboard without a recovery email keeps the role. The Staff screen warns about it.
- Still open from ticket 02: Clerk lets signed-in people delete their own account (`delete_self`), which could remove the last admin.

**26 November 2026: leaked-password check removed** at the project owner's request. It is off in the Clerk development instance, and the spec's Clerk setup section now says so for production too.

**26 November 2026: completed** in commits `5c2b306` and `8ca313e`, both pushed. CI had passed at `d41b4f2`; its run on `8ca313e` had not finished when this was written.

- The project owner ticked every criterion and asked for the ticket to be marked completed. No results of the real-account checks under "Still to do" were recorded here.
- The decisions listed for the project owner are not recorded as settled.

