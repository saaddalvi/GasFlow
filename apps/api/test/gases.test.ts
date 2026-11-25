import { gasListSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

test("lists the starting gases", async () => {
  const { app, signIn } = await startTestApp();
  const { headers } = await signIn();

  const response = await app.inject({ method: "GET", url: "/api/gases", headers });

  expect(response.statusCode).toBe(200);
  const { gases } = gasListSchema.parse(response.json());
  expect(gases.map((gas) => gas.name)).toEqual([
    "Medical oxygen",
    "Industrial oxygen",
    "Carbon dioxide",
    "Ammonia",
    "Nitrogen",
    "Argon",
    "DA (dissolved acetylene)",
    "Air",
    "Hydrogen",
    "Nitrous oxide",
  ]);
});
