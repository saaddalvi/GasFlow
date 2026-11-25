# 03: Manage staff accounts

**What to build:** an admin runs staff access from a Staff screen, with no email invitations. Covers user stories 5 to 10.

**Blocked by:** 02: Sign in with a username.

**Status:** ready-for-agent

- [ ] An admin can create an account with a name, username and starting password, and that person can then sign in
- [ ] Clerk's refusals (username taken or too short, password under 8 characters or found in a leak) are shown as clear messages
- [ ] An admin can set a new password for any staff member
- [ ] An admin can remove a staff member's access; that person can no longer use the app, and their staff record and name are kept
- [ ] An admin can make a staff member an admin or remove the role
- [ ] Every admin has a recovery email, required when the role is granted
- [ ] Staff who are not admins cannot see the Staff screen, and the API refuses their requests
- [ ] API tests cover each action as staff and as admin
