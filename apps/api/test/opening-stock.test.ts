import { openingStockListSchema, openingStockPartiesSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency, type Line } from "./support/agency";

const SOME_STOCK: Line[] = [{ gas: "Medical oxygen", quantity: 5 }];

/** The agency, with ways to enter opening stock and to see what has been. */
async function start(options?: { startDate: string | null }) {
  const agency = await startAgency(options);

  const enter = (partyId: string, lines: Line[] = SOME_STOCK) => agency.enter(partyId, lines);

  async function list(query = "") {
    const response = await agency.get(`/api/opening-stock?${query}`);
    expect(response.statusCode).toBe(200);
    return openingStockListSchema.parse(response.json());
  }

  /** The names of the parties the entry form offers. */
  async function offered() {
    const response = await agency.get("/api/opening-stock/parties", agency.admin);
    expect(response.statusCode).toBe(200);
    return openingStockPartiesSchema.parse(response.json()).parties.map((party) => party.name);
  }

  return { ...agency, enter, list, offered };
}

test("an admin enters the shop's opening stock as lines of gas, fill state and quantity", async () => {
  const { shop, gas, enter, get, admin, me } = await start();

  const bill = await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 40 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 12 },
    { gas: "Argon", fillState: "defective", quantity: 1 },
  ]);

  expect(bill).toMatchObject({
    type: "opening_stock",
    number: "OPN-20261101-001",
    date: START_DATE,
    status: "posted",
    from: null,
    to: { id: shop.id, name: shop.name, type: "shop" },
    lines: [
      { gas: { name: "Medical oxygen" }, fillState: "filled", quantity: 40 },
      { gas: { id: gas("Medical oxygen").id }, fillState: "empty", quantity: 12 },
      { gas: { name: "Argon" }, fillState: "defective", quantity: 1 },
    ],
    enteredBy: { id: (await me(admin.headers)).id, displayName: "Asha Patil" },
    enteredAt: "2026-11-26T06:30:00.000Z",
  });
  // Staff see it as it was saved.
  const viewed = await get(`/api/bills/${bill.id}`);
  expect(viewed.statusCode).toBe(200);
  expect(viewed.json()).toEqual(bill);
});

test.each(["customer", "refiller"] as const)(
  "an admin enters a %s's opening stock",
  async (type) => {
    const { addParty, enter } = await start();
    const party = await addParty(type, "City Hospital");

    const bill = await enter(party.id);

    expect(bill.to).toEqual({ id: party.id, name: "City Hospital", type });
  },
);

test("opening stock is dated the start date, whatever the request says", async () => {
  const { shop, asLines, postOpeningStock } = await start();

  const response = await postOpeningStock({
    partyId: shop.id,
    lines: asLines(SOME_STOCK),
    date: "2026-11-20",
    number: "MINE-1",
    status: "cancelled",
  });

  expect(response.json()).toMatchObject({
    date: START_DATE,
    number: "OPN-20261101-001",
    status: "posted",
  });
});

test("opening stock found later is still dated the start date and takes the next number", async () => {
  const { clock, shop, addParty, enter } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id);
  clock.set("2027-03-15T06:30:00.000Z");

  const bill = await enter(customer.id);

  expect(bill).toMatchObject({
    date: START_DATE,
    number: "OPN-20261101-002",
    enteredAt: "2027-03-15T06:30:00.000Z",
  });
});

test("opening stock entered at the same moment gets different numbers", async () => {
  const { addParty, enter, openConnections } = await start();
  const parties = [];
  for (const name of ["A", "B", "C", "D", "E"]) {
    parties.push(await addParty("customer", name));
  }
  await openConnections();

  const bills = await Promise.all(parties.map((party) => enter(party.id)));

  expect(bills.map((bill) => bill.number).sort()).toEqual([
    "OPN-20261101-001",
    "OPN-20261101-002",
    "OPN-20261101-003",
    "OPN-20261101-004",
    "OPN-20261101-005",
  ]);
});

/** Asserts that nothing was saved, by entering the party's opening stock afresh. */
async function expectNothingEntered({ enter, shop }: Awaited<ReturnType<typeof start>>) {
  // The first number is still free, and the shop has no opening stock.
  expect(await enter(shop.id)).toMatchObject({ number: "OPN-20261101-001" });
}

test("staff who are not admins cannot enter opening stock", async () => {
  const agency = await start();
  const { shop, staff, asLines, postOpeningStock } = agency;

  const response = await postOpeningStock({ partyId: shop.id, lines: asLines(SOME_STOCK) }, staff);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can do this." });
  await expectNothingEntered(agency);
});

test("opening stock cannot be entered before the start date is set", async () => {
  const { shop, asLines, postOpeningStock } = await start({ startDate: null });

  const response = await postOpeningStock({ partyId: shop.id, lines: asLines(SOME_STOCK) });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Set the start date before entering opening stock.",
  });
});

test("a second opening stock for a party is refused", async () => {
  const { addParty, asLines, postOpeningStock, enter } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id);

  const response = await postOpeningStock({
    partyId: customer.id,
    lines: asLines([{ gas: "Argon", quantity: 2 }]),
  });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Opening stock has already been entered for City Hospital, as OPN-20261101-001.",
  });
});

test("of two opening stocks for a party saved at the same moment, one is kept", async () => {
  const { shop, addParty, asLines, postOpeningStock, enter, openConnections } = await start();
  const payload = { partyId: shop.id, lines: asLines(SOME_STOCK) };
  await openConnections();

  const responses = await Promise.all([
    postOpeningStock(payload),
    postOpeningStock(payload),
    postOpeningStock(payload),
  ]);

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409]);
  // The refused saves used up no numbers.
  const customer = await addParty("customer", "City Hospital");
  expect(await enter(customer.id)).toMatchObject({ number: "OPN-20261101-002" });
});

test("a supplier cannot have opening stock", async () => {
  const agency = await start();
  const { addParty, asLines, postOpeningStock } = agency;
  const supplier = await addParty("supplier", "Everest Cylinders");

  const response = await postOpeningStock({ partyId: supplier.id, lines: asLines(SOME_STOCK) });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "A supplier holds no cylinders, so it has no opening stock.",
  });
  await expectNothingEntered(agency);
});

test("an inactive party cannot be given opening stock", async () => {
  const agency = await start();
  const { app, staff, addParty, asLines, postOpeningStock } = agency;
  const customer = await addParty("customer", "City Hospital");
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { active: false },
  });

  const response = await postOpeningStock({ partyId: customer.id, lines: asLines(SOME_STOCK) });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "City Hospital is inactive. Make it active first.",
  });
  await expectNothingEntered(agency);
});

test("a retired gas cannot be entered", async () => {
  const agency = await start();
  const { app, admin, shop, gas, asLines, postOpeningStock } = agency;
  await app.inject({
    method: "PATCH",
    url: `/api/gases/${gas("Argon").id}`,
    headers: admin.headers,
    payload: { active: false },
  });

  const response = await postOpeningStock({
    partyId: shop.id,
    lines: asLines([...SOME_STOCK, { gas: "Argon", quantity: 2 }]),
  });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Argon is retired. Bring it back to use it.",
  });
  await expectNothingEntered(agency);
});

test("a gas is the same gas however its id is capitalised", async () => {
  const { shop, gas, postOpeningStock } = await start();
  const { id } = gas("Argon");

  const response = await postOpeningStock({
    partyId: shop.id,
    lines: [
      { gasId: id, fillState: "filled", quantity: 1 },
      { gasId: id.toUpperCase(), fillState: "empty", quantity: 2 },
    ],
  });

  expect(response.statusCode).toBe(201);
});

const NOTHING = "0b8f2c6e-1f4a-4d0b-9c55-999999999999";

test.each([
  ["a party that does not exist", { partyId: NOTHING }, "There is no such party."],
  [
    "a gas that does not exist",
    { lines: [{ gasId: NOTHING, fillState: "filled", quantity: 1 }] },
    "There is no such gas.",
  ],
])("opening stock naming %s is refused", async (_case, change, message) => {
  const agency = await start();
  const { shop, asLines, postOpeningStock } = agency;

  const response = await postOpeningStock({
    partyId: shop.id,
    lines: asLines(SOME_STOCK),
    ...change,
  });

  expect(response.statusCode).toBe(404);
  expect(response.json()).toMatchObject({ message });
  await expectNothingEntered(agency);
});

/** A good line, with something about it changed. */
const lineWith = (change: object) => ({
  lines: [{ gasId: NOTHING, fillState: "filled", quantity: 1, ...change }],
});

test.each([
  ["no party", { partyId: undefined }, "Choose a party."],
  ["no lines", { lines: undefined }, "Add at least one line."],
  ["an empty list of lines", { lines: [] }, "Add at least one line."],
  ["too many lines", { lines: Array(101).fill(lineWith({}).lines[0]) }, "Use at most 100 lines."],
  ["a line with no gas", lineWith({ gasId: "" }), "Choose a gas on each line."],
  ["an unknown fill state", lineWith({ fillState: "full" }), "Choose filled, empty or defective."],
  ["a quantity of none", lineWith({ quantity: 0 }), "Enter a quantity of 1 or more on each line."],
  [
    "a negative quantity",
    lineWith({ quantity: -3 }),
    "Enter a quantity of 1 or more on each line.",
  ],
  ["part of a cylinder", lineWith({ quantity: 1.5 }), "Enter each quantity as a whole number."],
  ["a quantity in words", lineWith({ quantity: "five" }), "Enter each quantity as a whole number."],
  ["a quantity too large", lineWith({ quantity: 100_001 }), "Enter at most 100000 on a line."],
])("opening stock with %s is refused", async (_case, change, message) => {
  const agency = await start();
  const { shop, asLines, postOpeningStock } = agency;

  const response = await postOpeningStock({
    partyId: shop.id,
    lines: asLines(SOME_STOCK),
    ...change,
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  await expectNothingEntered(agency);
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "not-an-id"])(
  "%s, which is no bill, cannot be viewed",
  async (billId) => {
    const { get } = await start();

    const response = await get(`/api/bills/${billId}`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such bill." });
  },
);

test("staff see the existing entries by party name, with who entered each and when", async () => {
  const { clock, shop, addParty, enter, list, me, admin } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  const customer = await addParty("customer", "City Hospital");
  const ofRefiller = await enter(refiller.id);
  const ofShop = await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 40 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 12 },
  ]);
  clock.set("2026-11-27T09:00:00.000Z");
  const ofCustomer = await enter(customer.id);
  const enteredBy = { id: (await me(admin.headers)).id, displayName: "Asha Patil" };

  const listed = await list();

  const entry = { date: START_DATE, enteredBy, enteredAt: "2026-11-26T06:30:00.000Z" };
  expect(listed).toEqual({
    entries: [
      {
        ...entry,
        id: ofCustomer.id,
        number: ofCustomer.number,
        party: ofCustomer.to,
        quantity: 5,
        enteredAt: "2026-11-27T09:00:00.000Z",
      },
      { ...entry, id: ofShop.id, number: ofShop.number, party: ofShop.to, quantity: 52 },
      { ...entry, id: ofRefiller.id, number: ofRefiller.number, party: ofRefiller.to, quantity: 5 },
    ],
    total: 3,
    page: 1,
    pageSize: 50,
  });
});

test("the list of entries comes a page at a time", async () => {
  const { addParty, enter, list } = await start();
  for (let count = 1; count <= 51; count += 1) {
    const party = await addParty("customer", `Customer ${String(count).padStart(2, "0")}`);
    await enter(party.id);
  }

  const second = await list("page=2");

  expect(second).toMatchObject({ total: 51, page: 2, pageSize: 50 });
  expect(second.entries.map((entry) => entry.party.name)).toEqual(["Customer 51"]);
  expect((await list()).entries).toHaveLength(50);
});

test("the form offers the shop first, then customers and refillers by name", async () => {
  const { shop, addParty, offered } = await start();
  await addParty("refiller", "Zenith Gases");
  await addParty("customer", "apollo Clinic");
  await addParty("supplier", "Everest Cylinders");
  await addParty("customer", "City Hospital");

  expect(await offered()).toEqual([shop.name, "apollo Clinic", "City Hospital", "Zenith Gases"]);
});

test("the form no longer offers a party once it has opening stock, or while inactive", async () => {
  const { app, staff, shop, addParty, enter, offered } = await start();
  const done = await addParty("customer", "City Hospital");
  const gone = await addParty("customer", "Old Clinic");
  await addParty("customer", "Sharma Traders");
  await enter(shop.id);
  await enter(done.id);
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${gone.id}`,
    headers: staff.headers,
    payload: { active: false },
  });

  expect(await offered()).toEqual(["Sharma Traders"]);
});
