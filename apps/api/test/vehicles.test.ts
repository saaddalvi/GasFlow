import { vehicleListSchema, vehicleSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

const TEMPO = { plate: "MH 12 AB 1234", label: "Blue tempo" };

/** The app with a staff member signed in, who is not an admin unless asked. */
async function startSignedIn({ isAdmin = false } = {}) {
  const testApp = await startTestApp();
  const { app } = testApp;
  const { headers } = await testApp.signIn({ isAdmin });

  const postVehicle = (payload: object) =>
    app.inject({ method: "POST", url: "/api/vehicles", headers, payload });

  const changeVehicle = (vehicleId: string, payload: object) =>
    app.inject({ method: "PATCH", url: `/api/vehicles/${vehicleId}`, headers, payload });

  /** Adds a vehicle through the API, as the Vehicles screen does. */
  async function addVehicle(payload: object = TEMPO) {
    const response = await postVehicle(payload);
    expect(response.statusCode).toBe(201);
    return vehicleSchema.parse(response.json());
  }

  async function listVehicles(query = "") {
    const response = await app.inject({ method: "GET", url: `/api/vehicles?${query}`, headers });
    expect(response.statusCode).toBe(200);
    return vehicleListSchema.parse(response.json()).vehicles;
  }

  return { ...testApp, postVehicle, changeVehicle, addVehicle, listVehicles };
}

test.each([
  ["staff", false],
  ["an admin", true],
])("%s can add and change a vehicle", async (_who, isAdmin) => {
  const { addVehicle, changeVehicle, listVehicles } = await startSignedIn({ isAdmin });

  const added = await addVehicle();
  const response = await changeVehicle(added.id, { plate: "MH 14 CD 9", label: "Red pickup" });

  expect(added).toEqual({ ...TEMPO, id: added.id, active: true });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ ...added, plate: "MH 14 CD 9", label: "Red pickup" });
  expect(await listVehicles()).toEqual([response.json()]);
});

test("a vehicle needs only a plate", async () => {
  const { addVehicle } = await startSignedIn();

  const added = await addVehicle({ plate: " MH 12 AB 1234 ", label: " " });

  expect(added).toEqual({ id: added.id, plate: "MH 12 AB 1234", label: null, active: true });
});

test("a change leaves alone whatever it does not mention", async () => {
  const { addVehicle, changeVehicle } = await startSignedIn();
  const added = await addVehicle();

  const response = await changeVehicle(added.id, { label: "" });

  expect(response.json()).toEqual({ ...added, label: null });
});

test("vehicles are listed by plate, without inactive ones unless asked for", async () => {
  const { addVehicle, changeVehicle, listVehicles } = await startSignedIn();
  await addVehicle({ plate: "mh 14 cd 9" });
  const old = await addVehicle({ plate: "MH 20 EF 55" });
  await addVehicle({ plate: "MH 12 AB 1234" });

  await changeVehicle(old.id, { active: false });

  const plates = async (query?: string) =>
    (await listVehicles(query)).map((vehicle) => vehicle.plate);
  expect(await plates()).toEqual(["MH 12 AB 1234", "mh 14 cd 9"]);
  expect(await plates("inactive=true")).toEqual(["MH 12 AB 1234", "mh 14 cd 9", "MH 20 EF 55"]);
});

test.each([
  ["no plate", { plate: undefined }, "Enter the number plate."],
  ["a blank plate", { plate: "  " }, "Enter the number plate."],
  ["a plate too long", { plate: "M".repeat(21) }, "Use a number plate of at most 20 characters."],
  ["a label too long", { label: "a".repeat(101) }, "Use a label of at most 100 characters."],
])("a vehicle with %s is refused", async (_case, change, message) => {
  const { postVehicle, listVehicles } = await startSignedIn();

  const response = await postVehicle({ ...TEMPO, ...change });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await listVehicles()).toEqual([]);
});

test("a change that blanks the plate is refused", async () => {
  const { addVehicle, changeVehicle, listVehicles } = await startSignedIn();
  const added = await addVehicle();

  const response = await changeVehicle(added.id, { plate: "" });

  expect(response.statusCode).toBe(400);
  expect(await listVehicles()).toEqual([added]);
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "not-an-id"])(
  "%s, which is no vehicle, cannot be changed",
  async (vehicleId) => {
    const { changeVehicle } = await startSignedIn();

    const response = await changeVehicle(vehicleId, { label: "Red pickup" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such vehicle." });
  },
);
