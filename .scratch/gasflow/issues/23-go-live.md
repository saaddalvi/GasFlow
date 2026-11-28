# 23: Go live

**What to build:** GasFlow runs for the client on Vercel, Render and Neon with a production Clerk instance. A person is needed for accounts, plans, keys and a domain. It can be done any time after sign-in, so the client can try features as they arrive.

**Blocked by:** 02: Sign in with a username.

**Status:** ready-for-human

- [ ] Vercel, Render and Neon plans are chosen after checking current pricing; Vercel is the free Hobby plan, which permits only non-commercial use
- [ ] The web app, API and database run in the region closest to the shop
- [ ] A domain is chosen and connected
- [ ] The production Clerk instance matches the spec's Clerk setup section
- [ ] Production secrets are set in the hosting settings and none are committed
- [ ] Database migrations run as part of deployment, and the seed has created the shop and gases
- [ ] The first admin exists with a recovery email, and an account without an email can sign in
- [ ] Database recovery is set up on Neon and a restore has been tried
- [ ] The client has supplied the logo, gas list changes, number prefixes and start date before real data is entered

## Comments

**28 November 2026: Vercel plan chosen.**

- The project owner chose Vercel's free Hobby plan, stating that the project is not commercial.
- [Vercel's terms](https://vercel.com/legal/terms), section 4, limit that plan to personal or non-commercial use, and let Vercel shut such deployments down without notice. The spec speaks of a client and an agency; if a business comes to use the app, change plans first.
- The Neon plan is not yet chosen.

**28 November 2026: Render chosen for the API.**

- The project owner chose to host the API on Render instead of Vercel. The web app stays on Vercel.
- The Render plan is not yet chosen. [Render's free web services](https://render.com/docs/free) stop after 15 minutes without traffic, take about a minute to start again, and are described as not for production use.

**28 November 2026: deployment setup added, nothing deployed yet.**

- The project owner chose Render's free plan and has no domain yet. The Neon plan is still not chosen.
- Added `render.yaml`, `apps/web/vercel.json` (Singapore) and the README's **Deploying** section.
- Render's build applies migrations and runs the seed, because its free plan has no pre-deploy step. The seed needs `CLERK_SECRET_KEY` as well as `DATABASE_URL`.
- Until there is a domain, the deployment is a trial on Clerk's development instance. The domain and production Clerk criteria stay open.

Checked in a Node 24 container, on a clean copy of the repository:

- Render's build command ran twice against a new local database, leaving one shop and 10 gases. A first try without `CLERK_SECRET_KEY` failed at the seed.
- The start command answered a signed-out request with `401` and stopped cleanly.
- The web app built from `apps/web` with made-up keys.
- Nothing was run on Render, Vercel or Neon, or against Clerk.

Still to check once deployed:

- Both hosts use pnpm 11 and Node 24, and the API's host accepts `render.yaml`.
- Sign in, and save a bill.
- Open the app after the API has been idle for over 15 minutes.
- The checks noted in earlier tickets for go-live: `citext` on Neon, and many saves at once over the Neon connection.

**28 November 2026: trial deployment running.**

- Neon, Render and Vercel are on their free plans, with the database in Singapore. Sign-in uses Clerk's development instance. The addresses are left out, as this repository is public.
- Render created the API from `render.yaml`, from commit `12cb0df`. Vercel built the web app from the same commit.
- The first web deployment could not load any figures: `API_URL` held the Render service's ID, not its address. The project owner corrected it and redeployed, and reported the app working.
- The Neon database is Postgres 18. All 833 tests passed on a local Postgres 18.

Checked:

- After the API's first build, the database had all 19 migrations, one shop, 10 gases and the `citext` extension.
- The API answered a signed-out request and a made-up token with `401`.
- Signed-out visits to the web app ended at the sign-in page, which was served from Singapore.
- After the correction, one staff record was in the database, there were no bills, and the web app's logs showed no errors in the entries read.

Still to do:

- The web app's functions were running Node 26, not 24. Set 24.x in Vercel and redeploy.
- Confirm that both builds used pnpm 11, and that the API runs Node 24.
- Confirm that `CLERK_AUTHORIZED_PARTIES` is set in Render.
- Confirm that the development admin's password has been changed.
- Save a bill.
- Open the app after the API has been idle for over 15 minutes.
- Try many saves at once over the Neon connection.
- Try a restore on Neon, whose free plan keeps 6 hours of history here.
- A domain, the production Clerk instance, an account without an email there, and the client's logo, gas list changes, number prefixes and start date.
