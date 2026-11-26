import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/** The agency, with a refiller to send cylinders to. */
async function start() {
  const agency = await startAgency();
  const refiller = await agency.addParty("refiller", "Zenith Gases");
  return { ...agency, refiller };
}

test("staff save a send to refiller and see it as it was saved", async () => {
  const { shop, refiller, get, asLines, send } = await start();

  const bill = await send(refiller.id, {
    paperKind: "cash_memo",
    number: " 1234 ",
    lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 8 }]),
  });

  expect(bill).toMatchObject({
    type: "send_to_refiller",
    paperKind: "cash_memo",
    number: "1234",
    status: "posted",
    from: { id: shop.id, type: "shop" },
    to: { id: refiller.id, name: "Zenith Gases", type: "refiller" },
    lines: [{ gas: { name: "Medical oxygen" }, fillState: "empty", quantity: 8 }],
  });
  expect((await get(`/api/bills/${bill.id}`)).json()).toEqual(bill);
});

test("a send to refiller moves cylinders from the shop's fill states to the refiller", async () => {
  const { shop, refiller, enter, send, asLines, figures } = await start();
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "empty", quantity: 12 },
    { gas: "Medical oxygen", fillState: "defective", quantity: 3 },
  ]);

  await send(refiller.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "empty", quantity: 8 },
      { gas: "Medical oxygen", fillState: "defective", quantity: 1 },
    ]),
  });

  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 0, empty: 4, defective: 2 },
    customers: 0,
    refillers: 9,
    total: 15,
  });
});

test("staff save a return from refiller under the slip number and see it as it was saved", async () => {
  const { shop, refiller, get, asLines, refillerReturn } = await start();

  const bill = await refillerReturn(refiller.id, {
    number: " ZG/551 ",
    date: "2026-11-25",
    lines: asLines([{ gas: "Medical oxygen", fillState: "filled", quantity: 8 }]),
  });

  expect(bill).toMatchObject({
    type: "return_from_refiller",
    paperKind: null,
    number: "ZG/551",
    date: "2026-11-25",
    status: "posted",
    from: { id: refiller.id, name: "Zenith Gases", type: "refiller" },
    to: { id: shop.id, type: "shop" },
    lines: [{ gas: { name: "Medical oxygen" }, fillState: "filled", quantity: 8 }],
  });
  expect((await get(`/api/bills/${bill.id}`)).json()).toEqual(bill);
});

test("a return from refiller moves cylinders from the refiller into the shop's fill states", async () => {
  const { shop, refiller, enter, send, refillerReturn, asLines, figures } = await start();
  await enter(shop.id, [{ gas: "Medical oxygen", fillState: "empty", quantity: 12 }]);
  await send(refiller.id, {
    date: "2026-11-20",
    lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 10 }]),
  });

  await refillerReturn(refiller.id, {
    date: "2026-11-23",
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 6 },
      { gas: "Medical oxygen", fillState: "defective", quantity: 1 },
    ]),
  });

  expect(await figures("Medical oxygen", "date=2026-11-22")).toEqual({
    shop: { filled: 0, empty: 2, defective: 0 },
    customers: 0,
    refillers: 10,
    total: 12,
  });
  expect(await figures("Medical oxygen", "date=2026-11-23")).toEqual({
    shop: { filled: 6, empty: 2, defective: 1 },
    customers: 0,
    refillers: 3,
    total: 12,
  });
});

test("a refiller may return more than was sent, leaving a negative count", async () => {
  const { shop, refiller, enter, send, refillerReturn, asLines, figures } = await start();
  await enter(shop.id, [{ gas: "Medical oxygen", fillState: "empty", quantity: 4 }]);
  await send(refiller.id, {
    lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 4 }]),
  });

  await refillerReturn(refiller.id, { lines: asLines([{ gas: "Medical oxygen", quantity: 7 }]) });

  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 7, empty: 0, defective: 0 },
    customers: 0,
    refillers: -3,
    total: 4,
  });
});

const KINDS = [
  ["send to refiller", "sendFor"],
  ["return from refiller", "refillerReturnFor"],
] as const;

/** Asserts that the request was turned down and that no bill was saved. */
async function expectRefused(
  { postBill, bills }: Awaited<ReturnType<typeof start>>,
  payload: object,
  status: number,
  message: string,
) {
  const response = await postBill(payload);

  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ message });
  expect(await bills()).toMatchObject({ total: 0 });
}

test.each([
  [
    "sendFor",
    "customer",
    "City Hospital is not a refiller. A send to refiller goes to a refiller.",
  ],
  [
    "sendFor",
    "supplier",
    "City Hospital is not a refiller. A send to refiller goes to a refiller.",
  ],
  [
    "refillerReturnFor",
    "customer",
    "City Hospital is not a refiller. A return from refiller comes from a refiller.",
  ],
  [
    "refillerReturnFor",
    "supplier",
    "City Hospital is not a refiller. A return from refiller comes from a refiller.",
  ],
] as const)("%s naming a %s is refused", async (entry, type, message) => {
  const agency = await start();
  const other = await agency.addParty(type, "City Hospital");

  await expectRefused(agency, agency[entry](other.id), 409, message);
});

test.each(KINDS)("a %s cannot name the shop as the refiller", async (_kind, entry) => {
  const agency = await start();
  const { id, name } = agency.shop;

  const response = await agency.postBill(agency[entry](id));

  expect(response.statusCode).toBe(409);
  expect(response.json<{ message: string }>().message).toContain(`${name} is not a refiller.`);
});

test.each(KINDS)("a %s cannot name an inactive refiller", async (_kind, entry) => {
  const agency = await start();
  const { app, staff, refiller } = agency;
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${refiller.id}`,
    headers: staff.headers,
    payload: { active: false },
  });

  await expectRefused(
    agency,
    agency[entry](refiller.id),
    409,
    "Zenith Gases is inactive. Make it active first.",
  );
});

test.each(KINDS)("a %s dated before the start date is refused", async (_kind, entry) => {
  const agency = await start();

  await expectRefused(
    agency,
    agency[entry](agency.refiller.id, { date: "2026-10-31" }),
    409,
    "A bill cannot be dated before the start date.",
  );
});

test.each([
  ["sendFor", "no refiller", { refillerId: undefined }, "Choose a refiller."],
  ["sendFor", "no paper kind", { paperKind: undefined }, "Choose bill or cash memo."],
  ["sendFor", "no number", { number: "  " }, "Enter the bill number."],
  ["refillerReturnFor", "no refiller", { refillerId: "" }, "Choose a refiller."],
  ["refillerReturnFor", "no slip number", { number: "  " }, "Enter the refiller's slip number."],
  [
    "refillerReturnFor",
    "too long a slip number",
    { number: "1".repeat(31) },
    "Use a slip number of at most 30 characters.",
  ],
  ["refillerReturnFor", "no lines", { lines: [] }, "Add at least one line."],
] as const)("%s with %s is refused", async (entry, _case, change, message) => {
  const agency = await start();

  await expectRefused(agency, agency[entry](agency.refiller.id, change), 400, message);
});

test.each(["return", "return_from_customer"])(
  "a customer return, as type %s, cannot be entered as a new bill",
  async (type) => {
    const agency = await start();
    const customer = await agency.addParty("customer", "City Hospital");

    await expectRefused(
      agency,
      agency.dispatchFor(customer.id, { type }),
      400,
      "Choose the type of bill.",
    );
  },
);

test("the bill list shows refiller bills with their type, number and sides", async () => {
  const { shop, refiller, send, refillerReturn, bills } = await start();
  const sent = await send(refiller.id, { number: "41", date: "2026-11-20" });
  const back = await refillerReturn(refiller.id, { number: "ZG-9", date: "2026-11-21" });

  expect((await bills()).bills).toMatchObject([
    {
      id: back.id,
      type: "return_from_refiller",
      paperKind: null,
      number: "ZG-9",
      from: { id: refiller.id },
      to: { id: shop.id },
    },
    {
      id: sent.id,
      type: "send_to_refiller",
      paperKind: "bill",
      number: "41",
      from: { id: shop.id },
      to: { id: refiller.id },
    },
  ]);
});
