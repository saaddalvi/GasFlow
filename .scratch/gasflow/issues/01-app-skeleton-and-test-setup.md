# 01: App skeleton and test setup

**What to build:** a running GasFlow web app that shows the list of gases, fetched through the API from the database, with the test setup every later ticket builds on. Covers user story 12 and the start of 11.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A monorepo holds the web app (Next.js, App Router, TypeScript, compiled Tailwind), the API (Fastify) and a shared Zod package used by both
- [ ] Postgres runs locally through Docker Compose, with Prisma migrations
- [ ] Seeding creates the shop, named GasFlow, and the gases Medical oxygen, Industrial oxygen, Carbon dioxide, Ammonia, Nitrogen, Argon, DA (dissolved acetylene), Air, Hydrogen and Nitrous oxide; running it twice creates no duplicates
- [ ] The database allows only one shop, and no table has a firm key
- [ ] A page in the web app lists the gases returned by the API
- [ ] API tests send requests to the app in process against a real Postgres database, and each test starts from known data
- [ ] The identity provider and the clock each sit behind one replaceable interface, with test stand-ins; "today" is worked out in Indian Standard Time and a test shows the day changing at IST midnight
- [ ] Linting, formatting, type checks and tests run in CI
- [ ] An example environment file lists every setting, and no secrets are committed
- [ ] Setup and run instructions let a fresh checkout start the app and the tests
