import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

test("the list shows each bill's number, date, type, from and to, lines and status", async () => {
  const { shop, addParty, enter, dispatch, asLines, bills } = await startAgency();
  const customer = await addParty("customer", "City Hospital");
  const opening = await enter(shop.id, [{ gas: "Argon", fillState: "empty", quantity: 4 }]);
  const sent = await dispatch(customer.id, {
    paperKind: "cash_memo",
    number: "77",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", fillState: "empty", quantity: 2 },
    ]),
  });

  expect(await bills()).toEqual({
    bills: [
      {
        id: sent.id,
        type: "dispatch",
        paperKind: "cash_memo",
        number: "77",
        date: "2026-11-26",
        status: "posted",
        from: sent.from,
        to: sent.to,
        writeOffReason: null,
        lines: sent.lines,
      },
      {
        id: opening.id,
        type: "opening_stock",
        paperKind: null,
        number: opening.number,
        date: START_DATE,
        status: "posted",
        from: null,
        to: opening.to,
        writeOffReason: null,
        lines: opening.lines,
      },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  });
});

test("the newest bills come first: by date, then by when they were entered", async () => {
  const { clock, addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  await dispatch(id, { number: "first entered", date: "2026-11-20" });
  clock.set("2026-11-26T07:00:00.000Z");
  await dispatch(id, { number: "oldest date", date: "2026-11-05" });
  clock.set("2026-11-26T08:00:00.000Z");
  await dispatch(id, { number: "last entered", date: "2026-11-20" });
  await dispatch(id, { number: "newest date", date: "2026-11-25" });

  expect((await bills()).bills.map((bill) => bill.number)).toEqual([
    "newest date",
    "last entered",
    "first entered",
    "oldest date",
  ]);
});

test("the list comes a page at a time", async () => {
  const { addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  for (let day = 1; day <= 26; day += 1) {
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    await dispatch(id, { number: `${day}a`, date });
    if (day < 26) {
      await dispatch(id, { number: `${day}b`, date });
    }
  }

  const first = await bills();
  const second = await bills("page=2");

  expect(first.bills).toHaveLength(50);
  expect(second).toMatchObject({ total: 51, page: 2, pageSize: 50 });
  expect(second.bills.map((bill) => bill.date)).toEqual(["2026-11-01"]);
});

test.each(["0", "-1", "two", "1.5"])("there is no page %s", async (page) => {
  const { get } = await startAgency();

  const response = await get(`/api/bills?page=${page}`);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "There is no such page." });
});

test("the list shows cylinders added and written off, with who is on each side", async () => {
  const { admin, shop, addParty, addCylindersFor, writeOffFor, postBill, bills } =
    await startAgency();
  const supplier = await addParty("supplier", "Sharp Cylinders");
  await postBill(addCylindersFor({ date: "2026-11-20" }), admin);
  await postBill(addCylindersFor({ date: "2026-11-21", supplierId: supplier.id }), admin);
  await postBill(writeOffFor({ writeOffReason: "lost" }), admin);

  expect((await bills()).bills).toMatchObject([
    {
      type: "write_off",
      number: "WOF-20261126-001",
      from: { id: shop.id },
      to: null,
      writeOffReason: "lost",
    },
    {
      type: "add_cylinders",
      number: "ADD-20261121-001",
      from: { id: supplier.id, type: "supplier" },
      to: { id: shop.id },
      writeOffReason: null,
    },
    { type: "add_cylinders", number: "ADD-20261120-001", from: null, to: { id: shop.id } },
  ]);
});
