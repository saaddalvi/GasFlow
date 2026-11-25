import type { FastifyInstance } from "fastify";
import { expect, test } from "vitest";
import { adminOnly } from "../src/auth";
import { startTestApp } from "./support/test-app";

const ADMIN_ACTION = "/api/test/admin-only";

// No real action is limited to admins yet, so the tests add one that uses the
// same refusal as every real one will.
function addAdminAction(app: FastifyInstance): void {
  app.post(ADMIN_ACTION, { onRequest: adminOnly }, (request) => ({ actingAs: request.staff }));
}

test("a signed-out request for an admin action is refused", async () => {
  const { app } = await startTestApp(addAdminAction);

  const response = await app.inject({ method: "POST", url: ADMIN_ACTION });

  expect(response.statusCode).toBe(401);
});

test("staff are refused an admin action", async () => {
  const { app, signIn } = await startTestApp(addAdminAction);
  const { headers } = await signIn();

  const response = await app.inject({ method: "POST", url: ADMIN_ACTION, headers });

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can do this." });
});

test("an admin is allowed an admin action", async () => {
  const { app, signIn } = await startTestApp(addAdminAction);
  const { headers } = await signIn({ isAdmin: true });

  const me = await app.inject({ method: "GET", url: "/api/me", headers });
  const response = await app.inject({ method: "POST", url: ADMIN_ACTION, headers });

  expect(me.json()).toMatchObject({ isAdmin: true });
  expect(response.statusCode).toBe(200);
});

test("losing the admin role takes effect on the next request", async () => {
  const { app, identity, signIn } = await startTestApp(addAdminAction);
  const { identityId, headers } = await signIn({ isAdmin: true });
  const before = await app.inject({ method: "POST", url: ADMIN_ACTION, headers });

  identity.removeAdmin(identityId);
  const after = await app.inject({ method: "POST", url: ADMIN_ACTION, headers });

  expect(before.statusCode).toBe(200);
  expect(after.statusCode).toBe(403);
});

test("a request body cannot make its sender an admin", async () => {
  const { app, signIn } = await startTestApp(addAdminAction);
  const { headers } = await signIn();

  const response = await app.inject({
    method: "POST",
    url: ADMIN_ACTION,
    headers,
    payload: { isAdmin: true, role: "admin", staff: { isAdmin: true } },
  });

  expect(response.statusCode).toBe(403);
});

test("a request body cannot say who is asking", async () => {
  const { app, signIn, me } = await startTestApp(addAdminAction);
  const asha = await signIn({ displayName: "Asha Patil", isAdmin: true });
  const ravi = await signIn({ displayName: "Ravi Shah" });
  const ashaRecord = await me(asha.headers);
  const raviRecord = await me(ravi.headers);

  const response = await app.inject({
    method: "POST",
    url: ADMIN_ACTION,
    headers: asha.headers,
    payload: {
      staffId: raviRecord.id,
      identityId: ravi.identityId,
      displayName: "Mallory",
      staff: raviRecord,
    },
  });

  expect(response.json()).toEqual({ actingAs: ashaRecord });
  expect(await me(asha.headers)).toEqual(ashaRecord);
  expect(await me(ravi.headers)).toEqual(raviRecord);
});
