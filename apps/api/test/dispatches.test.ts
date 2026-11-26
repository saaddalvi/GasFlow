import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

/** The agency, with a customer to send cylinders to. */
async function start(options?: { startDate: string | null }) {
  const agency = await startAgency(options);
  const customer = await agency.addParty("customer", "City Hospital");
  return { ...agency, customer };
}

test("staff save a dispatch bill and see it as it was saved", async () => {
  const { staff, shop, customer, gas, get, me, addVehicle, asLines, dispatch } = await start();
  const vehicle = await addVehicle({ plate: "MH-12 AB 1234", label: "Blue tempo" });

  const bill = await dispatch(customer.id, {
    paperKind: "cash_memo",
    number: " 1234 ",
    date: "2026-11-25",
    vehicleId: vehicle.id,
    notes: "Left with the night nurse.",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", fillState: "empty", quantity: 2 },
    ]),
  });

  expect(bill).toMatchObject({
    type: "dispatch",
    paperKind: "cash_memo",
    number: "1234",
    date: "2026-11-25",
    status: "posted",
    from: { id: shop.id, name: shop.name, type: "shop" },
    to: { id: customer.id, name: "City Hospital", type: "customer" },
    vehicle: { id: vehicle.id, plate: "MH-12 AB 1234", label: "Blue tempo" },
    notes: "Left with the night nurse.",
    lines: [
      { gas: { id: gas("Medical oxygen").id }, fillState: "filled", quantity: 5 },
      { gas: { name: "Argon" }, fillState: "empty", quantity: 2 },
    ],
    enteredBy: { id: (await me(staff.headers)).id, displayName: "Ravi Shah" },
    enteredAt: "2026-11-26T06:30:00.000Z",
  });
  const viewed = await get(`/api/bills/${bill.id}`);
  expect(viewed.statusCode).toBe(200);
  expect(viewed.json()).toEqual(bill);
});

test("a dispatch needs no vehicle or notes", async () => {
  const { customer, dispatch } = await start();

  const bill = await dispatch(customer.id, { notes: "   " });

  expect(bill).toMatchObject({ vehicle: null, notes: null });
});

test("a dispatch moves cylinders from the shop to the customer at once", async () => {
  const { shop, customer, enter, dispatch, asLines, figures } = await start();
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 40 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 12 },
  ]);

  await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 5 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 2 },
    ]),
  });

  expect(await figures("Medical oxygen")).toMatchObject({
    shop: { filled: 35, empty: 10, defective: 0 },
    customers: 7,
    total: 52,
  });
});

test("a dispatch larger than the recorded shop stock is saved, leaving a negative count", async () => {
  const { shop, customer, enter, dispatch, figures } = await start();
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 3 }]);

  await dispatch(customer.id);

  expect(await figures("Medical oxygen")).toMatchObject({
    shop: { filled: -2, empty: 0, defective: 0 },
    customers: 5,
    total: 3,
  });
});

test("a bill with a past date counts from that day", async () => {
  const { customer, dispatch, figures } = await start();

  await dispatch(customer.id, { date: "2026-11-10" });

  expect(await figures("Medical oxygen", "date=2026-11-09")).toMatchObject({ customers: 0 });
  expect(await figures("Medical oxygen", "date=2026-11-10")).toMatchObject({ customers: 5 });
});

test("a bill may be dated the start date itself", async () => {
  const { customer, dispatch } = await start();

  const bill = await dispatch(customer.id, { date: START_DATE });

  expect(bill.date).toBe(START_DATE);
});

test("a bill dated before the start date is refused", async () => {
  const { customer, dispatchFor, postBill, figures } = await start();

  const response = await postBill(dispatchFor(customer.id, { date: "2026-10-31" }));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "A bill cannot be dated before the start date.",
  });
  expect(await figures("Medical oxygen")).toMatchObject({ customers: 0 });
});

test("no bill can be entered before the start date is set", async () => {
  const { customer, dispatchFor, postBill } = await start({ startDate: null });

  const response = await postBill(dispatchFor(customer.id));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "An admin has to set the start date before bills are entered.",
  });
});

test("admins enter dispatches too", async () => {
  const { admin, customer, dispatchFor, postBill } = await start();

  const response = await postBill(dispatchFor(customer.id), admin);

  expect(response.statusCode).toBe(201);
});

test("the request cannot choose where the cylinders leave from, who entered them or the status", async () => {
  const { shop, customer, addParty, dispatch, me, staff, admin } = await start();
  const other = await addParty("customer", "Apollo Clinic");

  const bill = await dispatch(customer.id, {
    fromPartyId: other.id,
    from: other,
    enteredById: (await me(admin.headers)).id,
    status: "cancelled",
  });

  expect(bill).toMatchObject({
    status: "posted",
    from: { id: shop.id },
    enteredBy: { id: (await me(staff.headers)).id },
  });
});

/** Asserts that the request was turned down and that no cylinders moved. */
async function expectRefused(
  agency: Awaited<ReturnType<typeof start>>,
  change: object,
  status: number,
  message: string,
) {
  const { customer, dispatchFor, postBill, bills } = agency;

  const response = await postBill(dispatchFor(customer.id, change));

  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ message });
  expect(await bills()).toMatchObject({ total: 0 });
}

test.each([
  ["a refiller", "refiller"],
  ["a supplier", "supplier"],
] as const)("a dispatch cannot go to %s", async (_case, type) => {
  const agency = await start();
  const other = await agency.addParty(type, "Zenith Gases");

  await expectRefused(
    agency,
    { customerId: other.id },
    409,
    "Zenith Gases is not a customer. A dispatch goes to a customer.",
  );
});

test("a dispatch cannot go to the shop", async () => {
  const agency = await start();
  const { id, name } = agency.shop;

  await expectRefused(
    agency,
    { customerId: id },
    409,
    `${name} is not a customer. A dispatch goes to a customer.`,
  );
});

test("a dispatch cannot go to an inactive customer", async () => {
  const agency = await start();
  const { app, staff, customer } = agency;
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { active: false },
  });

  await expectRefused(agency, {}, 409, "City Hospital is inactive. Make it active first.");
});

test("a dispatch cannot name an inactive vehicle", async () => {
  const agency = await start();
  const vehicle = await agency.addVehicle({ plate: "MH-12 AB 1234", active: false });

  await expectRefused(
    agency,
    { vehicleId: vehicle.id },
    409,
    "MH-12 AB 1234 is inactive. Make it active first.",
  );
});

test("a dispatch cannot use a retired gas", async () => {
  const agency = await start();
  const { app, admin, gas, asLines } = agency;
  await app.inject({
    method: "PATCH",
    url: `/api/gases/${gas("Argon").id}`,
    headers: admin.headers,
    payload: { active: false },
  });

  await expectRefused(
    agency,
    { lines: asLines([{ gas: "Argon", quantity: 1 }]) },
    409,
    "Argon is retired. Bring it back to use it.",
  );
});

const NOTHING = "0b8f2c6e-1f4a-4d0b-9c55-999999999999";

test.each([
  ["customer", { customerId: NOTHING }, "There is no such party."],
  ["vehicle", { vehicleId: NOTHING }, "There is no such vehicle."],
  [
    "gas",
    { lines: [{ gasId: NOTHING, fillState: "filled", quantity: 1 }] },
    "There is no such gas.",
  ],
])("a dispatch naming a %s that does not exist is refused", async (_case, change, message) => {
  await expectRefused(await start(), change, 404, message);
});

test.each([
  ["no type", { type: undefined }, "Choose the type of bill."],
  ["the type of a return", { type: "return" }, "Choose the type of bill."],
  ["the type of opening stock", { type: "opening_stock" }, "Choose the type of bill."],
  ["no paper kind", { paperKind: undefined }, "Choose bill or cash memo."],
  ["no number", { number: undefined }, "Enter the bill number."],
  ["a blank number", { number: "   " }, "Enter the bill number."],
  ["too long a number", { number: "1".repeat(31) }, "Use a bill number of at most 30 characters."],
  ["no date", { date: undefined }, "Choose the bill date."],
  ["a date that does not exist", { date: "2026-11-31" }, "Choose the bill date."],
  ["no customer", { customerId: "" }, "Choose a customer."],
  ["a vehicle that is not one", { vehicleId: "tempo" }, "Choose a vehicle from the list."],
  ["long notes", { notes: "x".repeat(1001) }, "Use notes of at most 1000 characters."],
  ["no lines", { lines: [] }, "Add at least one line."],
  [
    "an empty line",
    { lines: [{ gasId: NOTHING, fillState: "filled", quantity: 0 }] },
    "Enter a quantity of 1 or more on each line.",
  ],
])("a dispatch with %s is refused", async (_case, change, message) => {
  await expectRefused(await start(), change, 400, message);
});
