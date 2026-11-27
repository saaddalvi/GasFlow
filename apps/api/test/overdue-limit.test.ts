import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

/** The app with a staff member signed in, unless asked for an admin. */
async function startSignedIn({ isAdmin = false } = {}) {
  const testApp = await startTestApp();
  const { app } = testApp;
  const { headers } = await testApp.signIn({ isAdmin });

  const putLimit = (payload: object) =>
    app.inject({ method: "PUT", url: "/api/overdue-limit", headers, payload });

  async function limit(): Promise<unknown> {
    const response = await app.inject({ method: "GET", url: "/api/overdue-limit", headers });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  return { ...testApp, putLimit, limit };
}

test("the overdue limit starts at 30 days", async () => {
  const { limit } = await startSignedIn();

  expect(await limit()).toEqual({ days: 30 });
});

test("an admin changes the overdue limit, and can change it again", async () => {
  const { putLimit, limit } = await startSignedIn({ isAdmin: true });

  const response = await putLimit({ days: 45 });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ days: 45 });
  expect(await limit()).toEqual({ days: 45 });

  await putLimit({ days: 7 });

  expect(await limit()).toEqual({ days: 7 });
});

test("staff cannot change the overdue limit", async () => {
  const { putLimit, limit } = await startSignedIn();

  const response = await putLimit({ days: 45 });

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can do this." });
  expect(await limit()).toEqual({ days: 30 });
});

test.each([
  ["no number", {}, "Enter the overdue limit as a whole number of days."],
  ["words", { days: "thirty" }, "Enter the overdue limit as a whole number of days."],
  ["part of a day", { days: 30.5 }, "Enter the overdue limit as a whole number of days."],
  ["no days", { days: 0 }, "Use an overdue limit of 1 day or more."],
  ["less than no days", { days: -1 }, "Use an overdue limit of 1 day or more."],
  ["more than ten years", { days: 3651 }, "Use an overdue limit of at most 3650 days."],
])("an overdue limit of %s is refused", async (_case, payload, message) => {
  const { putLimit, limit } = await startSignedIn({ isAdmin: true });

  const response = await putLimit(payload);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await limit()).toEqual({ days: 30 });
});

test.each([1, 3650])("an overdue limit of %i can be chosen", async (days) => {
  const { putLimit, limit } = await startSignedIn({ isAdmin: true });

  const response = await putLimit({ days });

  expect(response.statusCode).toBe(200);
  expect(await limit()).toEqual({ days });
});

test("two first changes made at the same moment are both accepted", async () => {
  const { putLimit, limit, openConnections } = await startSignedIn({ isAdmin: true });
  await openConnections();

  const responses = await Promise.all([putLimit({ days: 40 }), putLimit({ days: 50 })]);

  expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
  expect([{ days: 40 }, { days: 50 }]).toContainEqual(await limit());
});
