import { staffSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

test("a staff member's first request creates their staff record, keeping the name", async () => {
  const { app, signIn } = await startTestApp();
  const { headers } = await signIn({ displayName: "Asha Patil" });

  const first = await app.inject({ method: "GET", url: "/api/me", headers });
  const second = await app.inject({ method: "GET", url: "/api/me", headers });

  expect(first.statusCode).toBe(200);
  expect(staffSchema.parse(first.json())).toMatchObject({
    displayName: "Asha Patil",
    isAdmin: false,
  });
  expect(second.json()).toEqual(first.json());
});

test("a new name reaches the same staff record on the next request", async () => {
  const { identity, signIn, me } = await startTestApp();
  const { identityId, headers } = await signIn({ displayName: "Asha Patil" });
  const before = await me(headers);

  identity.rename(identityId, "Asha Kulkarni");
  const after = await me(headers);

  expect(after).toEqual({ ...before, displayName: "Asha Kulkarni" });
});

test("each person has their own staff record", async () => {
  const { app, signIn } = await startTestApp();
  const asha = await signIn({ displayName: "Asha Patil" });
  const ravi = await signIn({ displayName: "Ravi Shah" });

  const first = await app.inject({ method: "GET", url: "/api/me", headers: asha.headers });
  const second = await app.inject({ method: "GET", url: "/api/me", headers: ravi.headers });

  expect(second.json()).toMatchObject({ displayName: "Ravi Shah" });
  expect(staffSchema.parse(second.json()).id).not.toBe(staffSchema.parse(first.json()).id);
});

test("first requests arriving together make one staff record", async () => {
  const { app, signIn } = await startTestApp();
  const { headers } = await signIn();

  const responses = await Promise.all(
    Array.from({ length: 8 }, () => app.inject({ method: "GET", url: "/api/me", headers })),
  );

  expect(responses.map((response) => response.statusCode)).toEqual(Array(8).fill(200));
  expect(new Set(responses.map((response) => staffSchema.parse(response.json()).id)).size).toBe(1);
});
