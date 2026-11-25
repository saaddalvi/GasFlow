import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

test("today is the date in India, changing at midnight there", async () => {
  const { app, clock, signIn } = await startTestApp();
  const { headers } = await signIn();

  // 25 November, 23:59:59.999 in India.
  clock.set("2026-11-25T18:29:59.999Z");
  const before = await app.inject({ method: "GET", url: "/api/today", headers });

  // 26 November, 00:00 in India, while it is still the 25th in UTC.
  clock.set("2026-11-25T18:30:00.000Z");
  const after = await app.inject({ method: "GET", url: "/api/today", headers });

  expect(before.json()).toEqual({ date: "2026-11-25" });
  expect(after.json()).toEqual({ date: "2026-11-26" });
});
