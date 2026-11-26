import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

test.each([
  "/api/gases",
  "/api/parties",
  "/api/shop",
  "/api/today",
  "/api/vehicles",
  "/api/no-such-thing",
])("a signed-out request for %s is refused", async (url) => {
  const { app } = await startTestApp();

  const response = await app.inject({ method: "GET", url });

  expect(response.statusCode).toBe(401);
});

test.each([
  ["a token nobody was given", "Bearer made-up"],
  ["a token for an account that does not exist", "Bearer test-session:nobody"],
  ["no token after the scheme", "Bearer "],
  ["another scheme", "Basic dXNlcjpwYXNz"],
])("a request with %s is refused", async (_case, authorization) => {
  const { app } = await startTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/gases",
    headers: { authorization },
  });

  expect(response.statusCode).toBe(401);
});
