# 23: Go live

**What to build:** GasFlow runs for the client on Vercel and Neon with a production Clerk instance. A person is needed for accounts, plans, keys and a domain. It can be done any time after sign-in, so the client can try features as they arrive.

**Blocked by:** 02: Sign in with a username.

**Status:** ready-for-human

- [ ] Vercel and Neon plans are chosen after checking current pricing; commercial use rules out Vercel's free plan
- [ ] The web app, API and database run in the region closest to the shop
- [ ] A domain is chosen and connected
- [ ] The production Clerk instance matches the spec's Clerk setup section
- [ ] Production secrets are set in the hosting settings and none are committed
- [ ] Database migrations run as part of deployment, and the seed has created the shop and gases
- [ ] The first admin exists with a recovery email, and an account without an email can sign in
- [ ] Database recovery is set up on Neon and a restore has been tried
- [ ] The client has supplied the logo, gas list changes, number prefixes and start date before real data is entered
