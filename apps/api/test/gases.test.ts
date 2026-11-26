import { gasListSchema, gasSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

const NAME_TAKEN = "There is already a gas with that name. It may be a retired one.";

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

/** The app with an admin signed in, unless asked for staff. */
async function startSignedIn({ isAdmin = true } = {}) {
  const testApp = await startTestApp();
  const { app } = testApp;
  const { headers } = await testApp.signIn({ isAdmin });

  const postGas = (payload: object) =>
    app.inject({ method: "POST", url: "/api/gases", headers, payload });

  const changeGas = (gasId: string, payload: object) =>
    app.inject({ method: "PATCH", url: `/api/gases/${gasId}`, headers, payload });

  async function listGases(query = "") {
    const response = await app.inject({ method: "GET", url: `/api/gases?${query}`, headers });
    expect(response.statusCode).toBe(200);
    return gasListSchema.parse(response.json()).gases;
  }

  const listNames = async (query?: string) => (await listGases(query)).map((gas) => gas.name);

  async function gasNamed(name: string) {
    const gas = (await listGases("retired=true")).find((candidate) => candidate.name === name);
    if (!gas) {
      throw new Error(`No gas named ${name}`);
    }
    return gas;
  }

  return { ...testApp, headers, postGas, changeGas, listGases, listNames, gasNamed };
}

test("an admin adds a gas, which joins the end of the list", async () => {
  const { postGas, listGases } = await startSignedIn();

  const response = await postGas({ name: "  Helium " });

  expect(response.statusCode).toBe(201);
  const added = gasSchema.parse(response.json());
  expect(added).toEqual({ id: added.id, name: "Helium", active: true });
  expect((await listGases()).at(-1)).toEqual(added);
});

test("an admin renames a gas, which keeps its place", async () => {
  const { changeGas, listNames, gasNamed } = await startSignedIn();
  const air = await gasNamed("Air");

  const response = await changeGas(air.id, { name: "Compressed air" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ ...air, name: "Compressed air" });
  expect((await listNames())[7]).toBe("Compressed air");
});

test("an admin corrects only the capitals of a gas's name", async () => {
  const { changeGas, gasNamed } = await startSignedIn();
  const air = await gasNamed("Air");

  const response = await changeGas(air.id, { name: "AIR" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ name: "AIR" });
});

test("a retired gas is no longer offered, but is shown when retired ones are asked for", async () => {
  const { changeGas, listGases, listNames, gasNamed } = await startSignedIn();
  const argon = await gasNamed("Argon");

  const response = await changeGas(argon.id, { active: false });

  expect(response.statusCode).toBe(200);
  // What new entries ask for.
  expect(await listNames()).not.toContain("Argon");
  expect(await listGases()).toHaveLength(9);
  expect(await listGases("retired=true")).toHaveLength(10);
  expect(await gasNamed("Argon")).toEqual({ ...argon, active: false });
});

test("an admin brings back a retired gas", async () => {
  const { changeGas, listNames, gasNamed } = await startSignedIn();
  const argon = await gasNamed("Argon");
  await changeGas(argon.id, { active: false });

  await changeGas(argon.id, { active: true });

  expect((await listNames())[5]).toBe("Argon");
});

test.each([
  ["the same name", "Argon"],
  ["other capitals", "ARGON"],
  ["spaces around it", " argon "],
])("a gas cannot be added under %s as one there is", async (_case, name) => {
  const { postGas, listGases } = await startSignedIn();

  const response = await postGas({ name });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: NAME_TAKEN });
  expect(await listGases()).toHaveLength(10);
});

test("a gas cannot take the name of another, even a retired one", async () => {
  const { changeGas, postGas, gasNamed } = await startSignedIn();
  const argon = await gasNamed("Argon");
  const air = await gasNamed("Air");
  await changeGas(argon.id, { active: false });

  const renamed = await changeGas(air.id, { name: "argon" });
  const added = await postGas({ name: "Argon" });

  for (const response of [renamed, added]) {
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: NAME_TAKEN });
  }
  expect(await gasNamed("Air")).toEqual(air);
});

test.each([
  ["no name", {}, "Enter the gas's name."],
  ["a blank name", { name: "  " }, "Enter the gas's name."],
  ["a name too long", { name: "a".repeat(51) }, "Use a name of at most 50 characters."],
])("a gas with %s is refused", async (_case, payload, message) => {
  const { postGas, listGases } = await startSignedIn();

  const response = await postGas(payload);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await listGases()).toHaveLength(10);
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "not-an-id"])(
  "%s, which is no gas, cannot be changed",
  async (gasId) => {
    const { changeGas } = await startSignedIn();

    const response = await changeGas(gasId, { name: "Helium" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such gas." });
  },
);

test("staff are refused adding a gas", async () => {
  const { postGas, listGases } = await startSignedIn({ isAdmin: false });

  const response = await postGas({ name: "Helium" });

  expect(response.statusCode).toBe(403);
  expect(await listGases()).toHaveLength(10);
});

test.each([
  ["renaming", { name: "Compressed air" }],
  ["retiring", { active: false }],
])("staff are refused %s a gas", async (_case, changes) => {
  const { changeGas, listGases, gasNamed } = await startSignedIn({ isAdmin: false });
  const before = await listGases();

  const response = await changeGas((await gasNamed("Air")).id, changes);

  expect(response.statusCode).toBe(403);
  expect(await listGases()).toEqual(before);
});
