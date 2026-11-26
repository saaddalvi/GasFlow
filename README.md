# GasFlow

A staff-only web app that tracks where a gas agency's cylinders are: at the shop,
with customers, or at refillers.

- What it does and why: [the spec](.scratch/gasflow/spec.md)
- The words used for things: [GLOSSARY.md](GLOSSARY.md)
- Decisions that are costly to reverse: [docs/adr/](docs/adr/)

## What you need

- [Node.js](https://nodejs.org) 24 (the version in `.nvmrc`)
- [pnpm](https://pnpm.io) 11: `npm install --global pnpm@11`
- [Docker](https://www.docker.com) with Docker Compose, for the local Postgres
- The publishable and secret keys of the GasFlow application in
  [Clerk](https://dashboard.clerk.com), from its project owner

## First run

From a fresh checkout:

```sh
cp .env.example .env   # then add the two Clerk keys; the rest works as it is
pnpm install
pnpm db:up             # starts Postgres and waits until it is ready
pnpm db:migrate        # creates or updates the tables
pnpm db:seed           # adds the shop and the starting gases
pnpm dev               # starts the API and the web app
```

Then open <http://localhost:3000> and sign in. If nobody has an account yet,
[create the first admin](#create-the-first-admin). The page after sign-in lists
the gases, which the web app reads from the API on <http://localhost:4000>.

Before opening stock can be entered, an admin sets the start date once, on the
**Opening stock** page. The app offers no way to change it.

If a port is already taken, change it in `.env`:

| Port in use    | Settings to change                                   |
| -------------- | ---------------------------------------------------- |
| 3000, web app  | `PORT`                                               |
| 4000, API      | `API_PORT` and `API_URL`                             |
| 5433, Postgres | `POSTGRES_PORT`, `DATABASE_URL`, `TEST_DATABASE_URL` |

After pulling new changes, run `pnpm install` and `pnpm db:migrate` again.

## Staff sign-in

Only staff can use the app. They sign in with a username and password, and there
is no sign-up: every page but `/sign-in` sends a signed-out visitor there, and the
API answers `401` to any request without a valid session token.

The Clerk application must be set up as in the spec's
[Clerk setup](.scratch/gasflow/spec.md#clerk-setup) section. The development
instance already is.

### Create the first admin

Do this once for each Clerk instance, in the
[Clerk dashboard](https://dashboard.clerk.com):

1. Open the GasFlow application and choose the instance (development or
   production).
2. Under **Users**, choose **Create user** and fill in:
   - first and last name, which bills will show;
   - a username of at least 4 characters;
   - a password of at least 8 characters;
   - **an email address the admin can read**. This is the recovery email, without
     which a forgotten admin password can only be reset from the dashboard.
3. Open the new user. Under **Metadata**, edit **Public** to the following and
   save:

   ```json
   { "role": "admin" }
   ```

4. Sign in to the app with that username and password.

An admin who forgets the password enters their username on the sign-in page,
chooses **Forgot password?** and follows the code sent to the recovery email.

### Manage staff

Everyone else is added in the app. Admins have a **Staff** screen, where they can:

- add a staff member with a name, username and starting password;
- set a new password for someone who has forgotten theirs. There are no email
  invitations or resets for staff, so tell them the password yourself;
- remove someone's access. This deletes their Clerk account and cannot be undone;
  their name stays in the app;
- make someone an admin, which asks for their recovery email, or change an
  admin's recovery email;
- remove the admin role, which also removes the recovery email.

The app does not let admins remove their own access or admin role, so that nobody
locks the agency out by mistake. A recovery email entered here is trusted without
sending a code to it, so check the spelling.

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
  `src/identity.ts`; the real one is `src/clerk-identity.ts`.
- Only the bill ledger, `src/services/ledger.ts`, changes bills. Each of its
  operations checks the rules and writes in one transaction. The database keeps
  bill numbers unique on each paper kind, ignoring cancelled bills.
- Reports only read. They work every figure out from posted bills, and no stock
  count is stored.
- A calendar date is text such as `2026-11-26`; `src/database-date.ts` converts
  it for the database.
- To turn a request down, throw a `Refusal` from `src/refusal.ts` with the status
  and a message fit to show the person. Check request bodies and query strings
  with `parseRequest`. The forms check what was typed against the same schemas
  first, with `checkInput` from `packages/shared`.
- Parties, vehicles and gases are never deleted: they are made inactive (a gas is
  "retired"), and their lists leave them out unless asked. Anything that offers
  them on a new entry must ask for the default list.
- Tests replace the clock and the identity provider, and nothing else, with the
  stand-ins in `test/support`.
- `src/auth.ts` requires sign-in for every request and puts the person in
  `request.staff`. Limit a route to admins with `{ onRequest: adminOnly }`.

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
