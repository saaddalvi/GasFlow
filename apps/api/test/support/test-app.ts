import { onTestFinished } from "vitest";
import { buildApp } from "../../src/app";
import { createDatabase } from "../../src/database";
import { TestClock } from "./test-clock";
import { testDatabaseUrl } from "./test-database";
import { TestIdentityProvider } from "./test-identity-provider";

/**
 * The app as the tests see it: in process, on the real test database, with
 * stand-ins for the clock and the identity provider. It closes itself.
 */
export async function startTestApp() {
  const db = createDatabase(testDatabaseUrl());
  const clock = new TestClock();
  const identity = new TestIdentityProvider();
  const app = buildApp({ db, clock, identity });
  onTestFinished(async () => {
    await app.close();
    await db.$disconnect();
  });
  await app.ready();

  return { app, db, clock, identity };
}
