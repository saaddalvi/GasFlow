import { dayLedgerSchema, type FillState } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

/** An agency, with a way to read its day ledger. */
async function startLedger(options?: Parameters<typeof startAgency>[0]) {
  const agency = await startAgency(options);

  /** The day ledger staff see for a query such as "date=2026-11-01". */
  async function ledger(query = "") {
    const response = await agency.get(`/api/reports/ledger?${query}`);
    expect(response.statusCode).toBe(200);
    return dayLedgerSchema.parse(response.json());
  }

  /**
   * One gas's Opening, In, Out and Closing counts of a fill state on a date, or
   * undefined if the ledger has no such column.
   */
  async function counts(date: string, fillState: FillState, gas = "Medical oxygen") {
    const table = (await ledger(`date=${date}`)).tables.find(
      (candidate) => candidate.fillState === fillState,
    );
    const column = table?.gases.find((candidate) => candidate.gas.name === gas);
    return column && [column.opening, column.in, column.out, column.closing];
  }

  return { ...agency, ledger, counts };
}

test("a dispatch goes out of the shop, from what it opened with", async () => {
  const { shop, addParty, enter, dispatch, counts } = await startLedger();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);
  await dispatch(customer.id, { date: "2026-11-10" });

  expect(await counts("2026-11-10", "filled")).toEqual([40, 0, 5, 35]);
});

test("opening stock is what the shop opens the start date with, and never comes in", async () => {
  const { shop, addParty, enter, dispatch, counts } = await startLedger();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);

  expect(await counts(START_DATE, "filled")).toEqual([40, 0, 0, 40]);

  // A bill on the start date itself still counts as movement.
  await dispatch(customer.id, { date: START_DATE });

  expect(await counts(START_DATE, "filled")).toEqual([40, 0, 5, 35]);
  expect(await counts("2026-11-02", "filled")).toEqual([35, 0, 0, 35]);
});

test("every bill that brings cylinders to the shop or takes them from it counts as in or out", async () => {
  const agency = await startLedger();
  const { shop, addParty, asLines, enter, dispatch, send, refillerReturn, counts } = agency;
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 100 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 100 },
    { gas: "Medical oxygen", fillState: "defective", quantity: 10 },
  ]);
  const date = "2026-11-26";
  const lines = (fillState: FillState, quantity: number) =>
    asLines([{ gas: "Medical oxygen", fillState, quantity }]);
  const sent = await dispatch(customer.id, { lines: lines("filled", 20) });
  await agency.receive(customer.id, [agency.against(sent, "Medical oxygen", 9)]);
  await send(refiller.id, { lines: lines("empty", 30) });
  await refillerReturn(refiller.id, { lines: lines("filled", 11) });
  const added = await agency.postBill(
    agency.addCylindersFor({ lines: lines("empty", 7) }),
    agency.admin,
  );
  expect(added.statusCode).toBe(201);
  const writtenOff = await agency.postBill(
    agency.writeOffFor({ lines: lines("defective", 4) }),
    agency.admin,
  );
  expect(writtenOff.statusCode).toBe(201);
  // A second dispatch, so that out adds up across bills.
  await dispatch(customer.id, { lines: lines("filled", 2) });

  // Filled: out on the two dispatches, in from the refiller.
  expect(await counts(date, "filled")).toEqual([100, 11, 22, 89]);
  // Empty: in from the return and the added cylinders, out to the refiller.
  expect(await counts(date, "empty")).toEqual([100, 16, 30, 86]);
  // Defective: out on the write-off.
  expect(await counts(date, "defective")).toEqual([10, 0, 4, 6]);
});

test("writing off a customer's or refiller's cylinders leaves the shop as it was", async () => {
  const agency = await startLedger();
  const { shop, addParty, asLines, enter, dispatch, counts } = agency;
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);
  await enter(refiller.id, [{ gas: "Medical oxygen", fillState: "empty", quantity: 8 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-10" });
  await agency.customerWriteOff(customer.id, sent, "Medical oxygen", 3);
  const writtenOff = await agency.postBill(
    agency.writeOffFor({
      refillerId: refiller.id,
      lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 2 }]),
    }),
    agency.admin,
  );
  expect(writtenOff.statusCode).toBe(201);

  expect(await counts("2026-11-26", "filled")).toEqual([35, 0, 0, 35]);
  expect(await counts("2026-11-26", "empty")).toEqual([0, 0, 0, 0]);
});

test("cancelled bills are left out, and a back-dated bill counts on its own date", async () => {
  const { shop, addParty, enter, dispatch, cancel, counts } = await startLedger();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);
  const mistake = await dispatch(customer.id, { date: "2026-11-20" });
  await cancel(mistake);

  expect(await counts("2026-11-20", "filled")).toEqual([40, 0, 0, 40]);

  // Entered today, but dated earlier.
  await dispatch(customer.id, { date: "2026-11-10" });

  expect(await counts("2026-11-10", "filled")).toEqual([40, 0, 5, 35]);
  expect(await counts("2026-11-20", "filled")).toEqual([35, 0, 0, 35]);
  expect(await counts("2026-11-26", "filled")).toEqual([35, 0, 0, 35]);
});

test("each day closes as the next one opens, and as the stock report shows the shop", async () => {
  const agency = await startLedger();
  const { shop, addParty, asLines, enter, dispatch, refillerReturn, ledger, report } = agency;
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 6 },
    { gas: "Argon", fillState: "empty", quantity: 3 },
  ]);
  await dispatch(customer.id, { date: START_DATE });
  const sent = await dispatch(customer.id, {
    date: "2026-11-02",
    lines: asLines([{ gas: "Argon", fillState: "empty", quantity: 2 }]),
  });
  // More filled cylinders go out than the shop has, so a count is below zero.
  await dispatch(customer.id, { date: "2026-11-03" });
  await agency.receive(
    customer.id,
    [agency.against(sent, "Argon", 1, { fillState: "defective" })],
    {
      date: "2026-11-03",
    },
  );
  await refillerReturn(refiller.id, { date: "2026-11-04" });

  let closedWith: unknown;
  for (const date of [START_DATE, "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]) {
    const { tables } = await ledger(`date=${date}`);
    const { rows } = await report(`date=${date}`);
    const shopCounts = (count: "opening" | "closing") =>
      tables.flatMap(({ fillState, gases }) =>
        gases
          .filter((column) => column[count] !== 0)
          .map((column) => `${column.gas.name} ${fillState} ${column[count]}`),
      );
    if (closedWith) {
      expect(shopCounts("opening").sort()).toEqual(closedWith);
    }
    closedWith = shopCounts("closing").sort();
    expect(closedWith).toEqual(
      rows
        .flatMap((row) =>
          Object.entries(row.shop)
            .filter(([, count]) => count !== 0)
            .map(([fillState, count]) => `${row.gas.name} ${fillState} ${count}`),
        )
        .sort(),
    );
  }
  expect(closedWith).toEqual(["Argon defective 1", "Argon empty 1", "Medical oxygen filled 1"]);
});

test("each table adds up its gases into a total", async () => {
  const { shop, addParty, asLines, enter, dispatch, refillerReturn, ledger } = await startLedger();
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 40 },
    { gas: "Argon", fillState: "filled", quantity: 7 },
    { gas: "Argon", fillState: "empty", quantity: 3 },
  ]);
  await dispatch(customer.id, {
    date: "2026-11-10",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  await refillerReturn(refiller.id, {
    date: "2026-11-10",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 4 },
      { gas: "Argon", quantity: 1 },
    ]),
  });

  const { tables } = await ledger("date=2026-11-10");

  expect(tables.map(({ fillState, total }) => ({ fillState, ...total }))).toEqual([
    { fillState: "filled", opening: 47, in: 5, out: 7, closing: 45 },
    { fillState: "empty", opening: 3, in: 0, out: 0, closing: 3 },
  ]);
});

test("filled and empty have a table even on a day with none of either", async () => {
  const { ledger } = await startLedger();

  const { tables } = await ledger(`date=${START_DATE}`);

  expect(tables.map((table) => table.fillState)).toEqual(["filled", "empty"]);
  expect(tables[0]?.total).toEqual({ opening: 0, in: 0, out: 0, closing: 0 });
});

test("defective has a table only on days it is used", async () => {
  const agency = await startLedger();
  const { addParty, asLines, dispatch, ledger } = agency;
  const customer = await addParty("customer", "City Hospital");
  const defective = asLines([{ gas: "Argon", fillState: "defective", quantity: 2 }]);
  const tablesOn = async (date: string) =>
    (await ledger(`date=${date}`)).tables.map((table) => table.fillState);
  // In and out on one day, leaving nothing behind.
  const added = await agency.postBill(
    agency.addCylindersFor({ date: "2026-11-10", lines: defective }),
    agency.admin,
  );
  expect(added.statusCode).toBe(201);
  await dispatch(customer.id, { date: "2026-11-10", lines: defective });

  expect(await tablesOn("2026-11-09")).toEqual(["filled", "empty"]);
  expect(await tablesOn("2026-11-10")).toEqual(["filled", "empty", "defective"]);
  expect(await tablesOn("2026-11-11")).toEqual(["filled", "empty"]);
});

test("every table has the same gases, in their usual order", async () => {
  const { shop, enter, ledger } = await startLedger();
  await enter(shop.id, [{ gas: "Argon", fillState: "defective", quantity: 2 }]);

  const { tables } = await ledger(`date=${START_DATE}`);

  const usualOrder = [
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
  ];
  expect(tables.map((table) => table.gases.map((column) => column.gas.name))).toEqual([
    usualOrder,
    usualOrder,
    usualOrder,
  ]);
});

test("a retired gas has a column only on days the shop has or moves some", async () => {
  const { app, admin, shop, gas, addParty, asLines, enter, dispatch, counts } = await startLedger();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Argon", quantity: 2 }]);
  await dispatch(customer.id, {
    date: "2026-11-10",
    lines: asLines([{ gas: "Argon", quantity: 2 }]),
  });
  for (const name of ["Argon", "Air"]) {
    await app.inject({
      method: "PATCH",
      url: `/api/gases/${gas(name).id}`,
      headers: admin.headers,
      payload: { active: false },
    });
  }

  expect(await counts("2026-11-09", "filled", "Argon")).toEqual([2, 0, 0, 2]);
  expect(await counts("2026-11-10", "filled", "Argon")).toEqual([2, 0, 2, 0]);
  // The same columns, though none of the day's Argon was empty.
  expect(await counts("2026-11-10", "empty", "Argon")).toEqual([0, 0, 0, 0]);
  // Only the customer has any by now.
  expect(await counts("2026-11-11", "filled", "Argon")).toBeUndefined();
  expect(await counts("2026-11-09", "filled", "Air")).toBeUndefined();
});

test("a date before the start date shows nothing", async () => {
  const { shop, enter, ledger } = await startLedger();
  await enter(shop.id, [{ gas: "Argon", quantity: 2 }]);

  expect(await ledger("date=2026-10-31")).toEqual({
    date: "2026-10-31",
    startDate: START_DATE,
    tables: [],
  });
});

test("there is nothing to show until the start date is set", async () => {
  const { ledger } = await startLedger({ startDate: null });

  expect(await ledger()).toEqual({ date: "2026-11-26", startDate: null, tables: [] });
});

test.each(["", "date="])("asked for '%s', the ledger is of today in India", async (query) => {
  const { clock, ledger } = await startLedger();
  clock.set("2026-11-26T19:00:00.000Z"); // half past midnight on 27 November in India

  expect(await ledger(query)).toMatchObject({ date: "2026-11-27", startDate: START_DATE });
});

test.each(["date=yesterday", "date=2026-02-30", "date=2026-11-01&date=2026-11-02"])(
  "a ledger for %s is refused",
  async (query) => {
    const { get } = await startLedger();

    const response = await get(`/api/reports/ledger?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Choose a date." });
  },
);
