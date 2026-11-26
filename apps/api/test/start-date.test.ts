import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

// The tests' clock stands at noon on 26 November 2026 in India.

/** The app with an admin signed in, unless asked for staff. */
async function startSignedIn({ isAdmin = true } = {}) {
  const testApp = await startTestApp();
  const { app } = testApp;
  const { headers } = await testApp.signIn({ isAdmin });

  const putStartDate = (payload: object) =>
    app.inject({ method: "PUT", url: "/api/start-date", headers, payload });

  async function startDate(): Promise<unknown> {
    const response = await app.inject({ method: "GET", url: "/api/start-date", headers });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  return { ...testApp, putStartDate, startDate };
}

test("there is no start date until setup", async () => {
  const { startDate } = await startSignedIn({ isAdmin: false });

  expect(await startDate()).toEqual({ startDate: null });
});

test("an admin sets the start date", async () => {
  const { putStartDate, startDate } = await startSignedIn();

  const response = await putStartDate({ date: "2026-11-01" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ startDate: "2026-11-01" });
  expect(await startDate()).toEqual({ startDate: "2026-11-01" });
});

test("the start date cannot be set a second time", async () => {
  const { putStartDate, startDate } = await startSignedIn();
  await putStartDate({ date: "2026-11-01" });

  const response = await putStartDate({ date: "2026-10-01" });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "The start date has already been set." });
  expect(await startDate()).toEqual({ startDate: "2026-11-01" });
});

test("of two start dates set at the same moment, one is kept", async () => {
  const { putStartDate, startDate, openConnections } = await startSignedIn();
  await openConnections();

  const responses = await Promise.all([
    putStartDate({ date: "2026-11-01" }),
    putStartDate({ date: "2026-10-01" }),
  ]);

  expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  const kept = responses.find((response) => response.statusCode === 200);
  expect(await startDate()).toEqual(kept?.json());
});

test("staff cannot set the start date", async () => {
  const { putStartDate, startDate } = await startSignedIn({ isAdmin: false });

  const response = await putStartDate({ date: "2026-11-01" });

  expect(response.statusCode).toBe(403);
  expect(await startDate()).toEqual({ startDate: null });
});

test("the start date can be today in India", async () => {
  const { clock, putStartDate } = await startSignedIn();
  clock.set("2026-11-26T19:00:00.000Z"); // half past midnight on 27 November in India

  const response = await putStartDate({ date: "2026-11-27" });

  expect(response.statusCode).toBe(200);
});

test.each([
  ["no date", {}, "Choose the start date."],
  ["a blank date", { date: "" }, "Choose the start date."],
  ["a date that does not exist", { date: "2026-02-30" }, "Choose the start date."],
  ["a date before 2000", { date: "1999-12-31" }, "Use a date in 2000 or later."],
  ["a date after today", { date: "2026-11-27" }, "The start date cannot be after today."],
])("a start date with %s is refused", async (_case, payload, message) => {
  const { putStartDate, startDate } = await startSignedIn();

  const response = await putStartDate(payload);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await startDate()).toEqual({ startDate: null });
});
