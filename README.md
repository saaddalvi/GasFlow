# GasFlow

A staff-only web app that tracks where a gas agency's cylinders are: at the shop,
with customers, or at refillers.

- What it does and why: [the spec](.scratch/gasflow/spec.md)
- The words used for things: [GLOSSARY.md](GLOSSARY.md)
- Decisions that are costly to reverse: [docs/adr/](docs/adr/)

> There is no sign-in yet, so the API answers anyone who can reach it. Run it on
> your own machine only.

## What you need

- [Node.js](https://nodejs.org) 24 (the version in `.nvmrc`)
- [pnpm](https://pnpm.io) 11: `npm install --global pnpm@11`
- [Docker](https://www.docker.com) with Docker Compose, for the local Postgres

## First run

From a fresh checkout:

```sh
cp .env.example .env   # the defaults work as they are
pnpm install
pnpm db:up             # starts Postgres and waits until it is ready
pnpm db:migrate        # creates or updates the tables
pnpm db:seed           # adds the shop and the starting gases
pnpm dev               # starts the API and the web app
```

Then open <http://localhost:3000>. The page lists the gases, which the web app
reads from the API on <http://localhost:4000>.

If a port is already taken, change it in `.env`:

| Port in use    | Settings to change                                   |
| -------------- | ---------------------------------------------------- |
| 3000, web app  | `PORT`                                               |
| 4000, API      | `API_PORT` and `API_URL`                             |
| 5433, Postgres | `POSTGRES_PORT`, `DATABASE_URL`, `TEST_DATABASE_URL` |

After pulling new changes, run `pnpm install` and `pnpm db:migrate` again.

## Tests

With Postgres running (`pnpm db:up`):

```sh
pnpm test
```

The tests send requests to the API in process, against the real Postgres database
named in `TEST_DATABASE_URL`. It is created if missing and **emptied before every
test**, then seeded, so each test starts from the same data. Its name must end in
`_test`, which protects your development data.

To run one file, or to rerun on changes:

```sh
pnpm --filter @gasflow/api run test test/gases.test.ts
pnpm --filter @gasflow/api run test:watch
```

`pnpm check` runs formatting, lint, type checks and tests, which CI also runs
before building the app. `pnpm format` fixes formatting.

## Layout

| Path              | Holds                                                      |
| ----------------- | ---------------------------------------------------------- |
| `apps/web`        | Next.js web app (App Router, TypeScript, Tailwind)         |
| `apps/api`        | Fastify API, Prisma schema and migrations, seed, API tests |
| `packages/shared` | Zod schemas used by both apps                              |

In the API:

- Routes (`src/routes`) handle HTTP; the work is done in `src/services`.
- The current time comes only from the `Clock` in `src/clock.ts`. "Today" is the
  date in Indian Standard Time, from `today()` in the same file.
- Accounts and sign-in go only through the `IdentityProvider` in
  `src/identity.ts`.
- Tests replace those two, and nothing else, with the stand-ins in
  `test/support`.

## Changing the database

Edit `apps/api/prisma/schema.prisma`, then create and apply a migration:

```sh
pnpm --filter @gasflow/api run db:migrate:new --name what_changed
pnpm --filter @gasflow/api run db:generate
```

Commit the new folder under `apps/api/prisma/migrations`.

## Stopping

`Ctrl+C` stops the apps. `pnpm db:down` stops Postgres and keeps its data;
`docker compose down --volumes` deletes the data too.
