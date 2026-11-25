import { staffSchema } from "@gasflow/shared";
import type { FastifyInstance } from "fastify";
import { onTestFinished } from "vitest";
import { buildApp } from "../../src/app";
import { createDatabase } from "../../src/database";
import { TestClock } from "./test-clock";
import { testDatabaseUrl } from "./test-database";
import { TestIdentityProvider } from "./test-identity-provider";

/**
 * The app as the tests see it: in process, on the real test database, with
 * stand-ins for the clock and the identity provider. It closes itself. A test
 * may add routes of its own before the app starts.
 */
export async function startTestApp(addRoutes?: (app: FastifyInstance) => void) {
  const db = createDatabase(testDatabaseUrl());
  const clock = new TestClock();
  const identity = new TestIdentityProvider();
  const app = buildApp({ db, clock, identity });
  onTestFinished(async () => {
    await app.close();
    await db.$disconnect();
  });
  addRoutes?.(app);
  await app.ready();

  /** Creates a new account and gives the headers its requests would carry. */
  async function signIn({ displayName = "Asha Patil", isAdmin = false } = {}) {
    const account = await identity.createAccount({
      displayName,
      username: displayName.toLowerCase().replaceAll(" ", "."),
      password: "not-checked-by-the-stand-in",
    });
    if (isAdmin) {
      identity.makeAdmin(account.identityId);
    }
    return {
      identityId: account.identityId,
      headers: { authorization: `Bearer ${identity.sessionToken(account.identityId)}` },
    };
  }

  /** The staff record the API reports for whoever sends these headers. */
  async function me(headers: { authorization: string }) {
    const response = await app.inject({ method: "GET", url: "/api/me", headers });
    return staffSchema.parse(response.json());
  }

  return { app, db, clock, identity, signIn, me };
}
