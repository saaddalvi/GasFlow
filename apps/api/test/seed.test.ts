import { gasListSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { seedDatabase } from "../src/seed";
import { startTestApp } from "./support/test-app";

test("seeding creates the shop, named GasFlow", async () => {
  const { app, signIn } = await startTestApp();
  const { headers } = await signIn();

  const response = await app.inject({ method: "GET", url: "/api/shop", headers });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ name: "GasFlow" });
});

test("seeding again changes nothing", async () => {
  const { app, db, signIn } = await startTestApp();
  const { headers } = await signIn();
  const gasesBefore = await app.inject({ method: "GET", url: "/api/gases", headers });
  const shopBefore = await app.inject({ method: "GET", url: "/api/shop", headers });

  await seedDatabase(db);

  const gasesAfter = await app.inject({ method: "GET", url: "/api/gases", headers });
  const shopAfter = await app.inject({ method: "GET", url: "/api/shop", headers });
  expect(gasesAfter.json()).toEqual(gasesBefore.json());
  expect(shopAfter.json()).toEqual(shopBefore.json());
  expect(gasListSchema.parse(gasesAfter.json()).gases).toHaveLength(10);
});

test("seeding again keeps what an admin did to the starting gases", async () => {
  const { app, db, signIn } = await startTestApp();
  const { headers } = await signIn({ isAdmin: true });
  const list = async () =>
    gasListSchema.parse(
      (await app.inject({ method: "GET", url: "/api/gases?retired=true", headers })).json(),
    ).gases;
  const [first, second] = await list();
  const change = (gasId: string | undefined, payload: object) =>
    app.inject({ method: "PATCH", url: `/api/gases/${gasId}`, headers, payload });
  await change(first?.id, { name: "Oxygen" });
  await change(second?.id, { active: false });
  const before = await list();

  await seedDatabase(db);

  expect(await list()).toEqual(before);
});
