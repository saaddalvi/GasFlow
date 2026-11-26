import { stockReportSchema, type StockReportRow } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency, type Line } from "./support/agency";

/** The agency, with ways to read the report. */
async function start(options?: { startDate: string | null }) {
  const agency = await startAgency(options);

  /** The report staff see for a query such as "date=2026-11-01". */
  async function report(query = "") {
    const response = await agency.get(`/api/reports/stock?${query}`);
    expect(response.statusCode).toBe(200);
    return stockReportSchema.parse(response.json());
  }

  /** The figures of one gas, or undefined if the report leaves it out. */
  async function figures(gas: string, query?: string) {
    const row = (await report(query)).rows.find((candidate) => candidate.gas.name === gas);
    if (!row) {
      return undefined;
    }
    const counts: Partial<StockReportRow> = { ...row };
    delete counts.gas;
    return counts;
  }

  return { ...agency, report, figures };
}

const NONE = {
  shop: { filled: 0, empty: 0, defective: 0 },
  customers: 0,
  refillers: 0,
  total: 0,
};

test("the report shows each gas at the shop by fill state, with customers, at refillers and in total", async () => {
  const { shop, addParty, enter, figures } = await start();
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Apollo Clinic");
  const plant = await addParty("refiller", "Zenith Gases");
  const otherPlant = await addParty("refiller", "Coastal Air");
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 40 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 12 },
    { gas: "Medical oxygen", fillState: "defective", quantity: 3 },
    // The same gas and fill state on another line.
    { gas: "Medical oxygen", fillState: "filled", quantity: 2 },
    { gas: "Argon", fillState: "empty", quantity: 6 },
  ]);
  await enter(hospital.id, [{ gas: "Medical oxygen", quantity: 10 }]);
  await enter(clinic.id, [
    { gas: "Medical oxygen", quantity: 4 },
    { gas: "Argon", quantity: 1 },
  ]);
  await enter(plant.id, [{ gas: "Medical oxygen", fillState: "empty", quantity: 7 }]);
  await enter(otherPlant.id, [{ gas: "Medical oxygen", fillState: "empty", quantity: 5 }]);

  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 42, empty: 12, defective: 3 },
    customers: 14,
    refillers: 12,
    total: 83,
  });
  expect(await figures("Argon")).toEqual({
    shop: { filled: 0, empty: 6, defective: 0 },
    customers: 1,
    refillers: 0,
    total: 7,
  });
  expect(await figures("Nitrogen")).toEqual(NONE);
});

test("what a customer or refiller holds adds up across fill states", async () => {
  const { addParty, enter, figures } = await start();
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  const mixed: Line[] = [
    { gas: "Nitrogen", fillState: "filled", quantity: 5 },
    { gas: "Nitrogen", fillState: "empty", quantity: 2 },
    { gas: "Nitrogen", fillState: "defective", quantity: 1 },
  ];
  await enter(customer.id, mixed);
  await enter(refiller.id, [...mixed, { gas: "Nitrogen", fillState: "empty", quantity: 3 }]);

  expect(await figures("Nitrogen")).toEqual({ ...NONE, customers: 8, refillers: 11, total: 19 });
});

test("the report lists the gases in their usual order", async () => {
  const { app, admin, report } = await start();
  await app.inject({
    method: "POST",
    url: "/api/gases",
    headers: admin.headers,
    payload: { name: "Helium" },
  });

  const names = (await report()).rows.map((row) => row.gas.name);

  expect(names).toEqual([
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
    "Helium",
  ]);
});

test("a retired gas is listed only while there are cylinders of it", async () => {
  const { app, admin, shop, gas, enter, figures } = await start();
  await enter(shop.id, [{ gas: "Argon", quantity: 2 }]);
  for (const name of ["Argon", "Air"]) {
    await app.inject({
      method: "PATCH",
      url: `/api/gases/${gas(name).id}`,
      headers: admin.headers,
      payload: { active: false },
    });
  }

  expect(await figures("Argon")).toMatchObject({ total: 2 });
  expect(await figures("Air")).toBeUndefined();
});

test.each([START_DATE, "2026-11-15", "2027-01-31"])(
  "opening stock counts on %s, from the start date on",
  async (date) => {
    const { shop, enter, report, figures } = await start();
    await enter(shop.id, [{ gas: "Argon", quantity: 2 }]);

    expect((await report(`date=${date}`)).date).toBe(date);
    expect(await figures("Argon", `date=${date}`)).toMatchObject({ total: 2 });
  },
);

test("a date before the start date shows nothing", async () => {
  const { shop, enter, report } = await start();
  await enter(shop.id, [{ gas: "Argon", quantity: 2 }]);

  expect(await report("date=2026-10-31")).toEqual({
    date: "2026-10-31",
    startDate: START_DATE,
    rows: [],
  });
});

test("there is nothing to show until the start date is set", async () => {
  const { report } = await start({ startDate: null });

  expect(await report()).toEqual({ date: "2026-11-26", startDate: null, rows: [] });
});

test.each(["", "date="])("asked for '%s', the report is of today in India", async (query) => {
  const { clock, report } = await start();
  clock.set("2026-11-26T19:00:00.000Z"); // half past midnight on 27 November in India

  expect(await report(query)).toMatchObject({ date: "2026-11-27", startDate: START_DATE });
});

test.each(["date=yesterday", "date=2026-02-30", "date=2026-11-01&date=2026-11-02"])(
  "a report for %s is refused",
  async (query) => {
    const { get } = await start();

    const response = await get(`/api/reports/stock?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Choose a date." });
  },
);
