# 01: App skeleton and test setup

**What to build:** a running GasFlow web app that shows the list of gases, fetched through the API from the database, with the test setup every later ticket builds on. Covers user story 12 and the start of 11.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] A monorepo holds the web app (Next.js, App Router, TypeScript, compiled Tailwind), the API (Fastify) and a shared Zod package used by both
- [x] Postgres runs locally through Docker Compose, with Prisma migrations
- [x] Seeding creates the shop, named GasFlow, and the gases Medical oxygen, Industrial oxygen, Carbon dioxide, Ammonia, Nitrogen, Argon, DA (dissolved acetylene), Air, Hydrogen and Nitrous oxide; running it twice creates no duplicates
- [x] The database allows only one shop, and no table has a firm key
- [x] A page in the web app lists the gases returned by the API
- [x] API tests send requests to the app in process against a real Postgres database, and each test starts from known data
- [x] The identity provider and the clock each sit behind one replaceable interface, with test stand-ins; "today" is worked out in Indian Standard Time and a test shows the day changing at IST midnight
- [x] Linting, formatting, type checks and tests run in CI
- [x] An example environment file lists every setting, and no secrets are committed
- [x] Setup and run instructions let a fresh checkout start the app and the tests

## Comments

**26 November 2026: completed** in commit `80becf1`. [CI passed](https://github.com/saaddalvi/GasFlow/actions/runs/45702015246).

- The one-shop rule and the absence of firm keys were checked by hand. Automated tests go through the API, which cannot create a shop yet; ticket 04 can cover this.
- `GET /api/shop` and `GET /api/today` were added so that tests can check the seed and the date through the API.
- No API request needs sign-in yet. The identity provider connected to the running app accepts no token until ticket 02 replaces it.
- For ticket 04: gas names are unique, but the check is case-sensitive ("Argon" and "argon" count as different).

