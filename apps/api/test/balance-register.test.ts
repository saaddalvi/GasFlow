import { balanceRegisterSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India, and the records
// begin on 1 November.

/** The agency, with the means to read the balance register as its screen does. */
async function start(options?: Parameters<typeof startAgency>[0]) {
  const agency = await startAgency(options);
  const { get } = agency;

  /** The register for a query such as "type=customer". */
  async function register(query = "") {
    const response = await get(`/api/reports/party-balance?${query}`);
    expect(response.statusCode).toBe(200);
    return balanceRegisterSchema.parse(response.json());
  }

  return { ...agency, register };
}

test("each customer and refiller is listed by name with type, gases held and total", async () => {
  const { addParty, enter, register, held } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  const customer = await addParty("customer", "City Hospital");
  await enter(refiller.id, [{ gas: "Nitrogen", fillState: "empty", quantity: 7 }]);
  await enter(customer.id, [
    { gas: "Argon", quantity: 2 },
    { gas: "Medical oxygen", fillState: "filled", quantity: 6 },
    // Another fill state of the same gas, which adds to it.
    { gas: "Medical oxygen", fillState: "empty", quantity: 4 },
  ]);

  expect(await register()).toEqual({
    date: "2026-11-26",
    startDate: START_DATE,
    parties: [
      {
        id: customer.id,
        type: "customer",
        name: "City Hospital",
        active: true,
        gases: [held("Medical oxygen", 10), held("Argon", 2)],
        total: 12,
      },
      {
        id: refiller.id,
        type: "refiller",
        name: "Zenith Gases",
        active: true,
        gases: [held("Nitrogen", 7)],
        total: 7,
      },
    ],
    summary: { held: 19, belowZero: 0 },
    total: 2,
    page: 1,
    pageSize: 50,
  });
});

test("each date counts the bills dated up to its end, and no cancelled bill", async () => {
  const { addParty, enter, dispatch, receive, against, cancel, register, held } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Argon", quantity: 2 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-10" });
  await receive(customer.id, [against(sent, "Medical oxygen", 3)], { date: "2026-11-20" });
  await cancel(await dispatch(customer.id, { date: "2026-11-05" }));

  const on = async (date: string) => (await register(`date=${date}`)).parties[0];

  expect(await on("2026-11-09")).toMatchObject({ gases: [held("Argon", 2)], total: 2 });
  expect(await on("2026-11-10")).toMatchObject({
    gases: [held("Medical oxygen", 5), held("Argon", 2)],
    total: 7,
  });
  expect(await on("2026-11-20")).toMatchObject({
    gases: [held("Medical oxygen", 2), held("Argon", 2)],
    total: 4,
  });
});

test("the shop and suppliers are not listed as holders", async () => {
  const { shop, addParty, enter, postBill, addCylindersFor, admin, register } = await start();
  await enter(shop.id, [{ gas: "Argon", quantity: 50 }]);
  const supplier = await addParty("supplier", "Sharp Cylinders");
  const added = await postBill(addCylindersFor({ supplierId: supplier.id }), admin);
  expect(added.statusCode).toBe(201);

  expect(await register("show=all")).toMatchObject({
    parties: [],
    summary: { held: 0, belowZero: 0 },
    total: 0,
  });
});

test("the figures match the stock report for the same date", async () => {
  const agency = await start();
  const { shop, addParty, enter, dispatch, send, refillerReturn, receive, against } = agency;
  const { unmatchedRow, asLines, customerWriteOff, postBill, writeOffFor, admin } = agency;
  const { register, report } = agency;
  await enter(shop.id, [{ gas: "Argon", quantity: 50 }]);
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Lotus Clinic");
  const deccan = await addParty("refiller", "Deccan Gases");
  await enter(hospital.id, [{ gas: "Argon", quantity: 4 }]);
  const sent = await dispatch(hospital.id, { date: "2026-11-05" });
  await receive(hospital.id, [against(sent, "Medical oxygen", 2)], { date: "2026-11-08" });
  await customerWriteOff(hospital.id, sent, "Medical oxygen", 1, { date: "2026-11-09" });
  await receive(clinic.id, [], { date: "2026-11-10", unmatched: [unmatchedRow("Nitrogen", 3)] });
  await send(deccan.id, { date: "2026-11-12" });
  await refillerReturn(deccan.id, {
    date: "2026-11-15",
    lines: asLines([{ gas: "Medical oxygen", quantity: 2 }]),
  });
  const written = await postBill(
    writeOffFor({
      refillerId: deccan.id,
      date: "2026-11-18",
      lines: asLines([{ gas: "Medical oxygen", fillState: "defective", quantity: 1 }]),
    }),
    admin,
  );
  expect(written.statusCode).toBe(201);

  for (const date of ["2026-11-01", "2026-11-07", "2026-11-11", "2026-11-14", "2026-11-26"]) {
    const { rows } = await report(`date=${date}`);
    const { parties, summary } = await register(`date=${date}`);
    for (const type of ["customer", "refiller"] as const) {
      for (const { gas, customers, refillers } of rows) {
        const registered = parties
          .filter((party) => party.type === type)
          .flatMap((party) => party.gases)
          .filter((held) => held.gas.id === gas.id)
          .reduce((sum, { quantity }) => sum + quantity, 0);
        expect(registered, `${gas.name} with ${type}s on ${date}`).toBe(
          type === "customer" ? customers : refillers,
        );
      }
    }
    expect(summary.held, `held on ${date}`).toBe(
      rows.reduce((sum, row) => sum + row.customers + row.refillers, 0),
    );
  }
});

test.each(["2026-10-31", "2025-01-01"])(
  "on %s, before the start date, nothing is listed",
  async (date) => {
    const { addParty, enter, register } = await start();
    await enter((await addParty("customer", "City Hospital")).id, [{ gas: "Argon", quantity: 2 }]);

    expect(await register(`date=${date}&show=all`)).toEqual({
      date,
      startDate: START_DATE,
      parties: [],
      summary: { held: 0, belowZero: 0 },
      total: 0,
      page: 1,
      pageSize: 50,
    });
  },
);

test("there is nothing to list until the start date is set", async () => {
  const { addParty, register } = await start({ startDate: null });
  await addParty("customer", "City Hospital");

  expect(await register("show=all")).toMatchObject({ startDate: null, parties: [], total: 0 });
});

test.each(["", "date="])("asked for '%s', the register is of today in India", async (query) => {
  const { clock, register } = await start();
  clock.set("2026-11-26T19:00:00.000Z"); // half past midnight on 27 November in India

  expect(await register(query)).toMatchObject({ date: "2026-11-27" });
});

/**
 * Parties that stand differently: City Hospital holds some, Lotus Clinic fewer
 * than none, Metro Care nothing after returning all, and New Ward has no bill.
 * Deccan Gases holds some of one gas and as many fewer than none of another.
 */
async function startWithParties() {
  const agency = await start();
  const { addParty, dispatch, receive, against, unmatchedRow, send, refillerReturn } = agency;
  const { asLines } = agency;
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Lotus Clinic");
  const metro = await addParty("customer", "Metro Care");
  const ward = await addParty("customer", "New Ward");
  const deccan = await addParty("refiller", "Deccan Gases");
  await dispatch(hospital.id);
  await receive(clinic.id, [], { unmatched: [unmatchedRow("Argon", 2)] });
  const sent = await dispatch(metro.id);
  await receive(metro.id, [against(sent, "Medical oxygen", 5)]);
  await send(deccan.id);
  await refillerReturn(deccan.id, { lines: asLines([{ gas: "Argon", quantity: 5 }]) });
  return { ...agency, hospital, clinic, metro, ward, deccan };
}

const names = ({ parties }: { parties: { name: string }[] }) => parties.map(({ name }) => name);

test.each(["", "show=", "show=non_zero"])(
  "asked for '%s', only parties holding cylinders, or fewer than none, are listed",
  async (query) => {
    const { register } = await startWithParties();

    const listed = await register(query);

    // Deccan Gases holds nothing all together, but not nothing of each gas.
    expect(names(listed)).toEqual(["City Hospital", "Deccan Gases", "Lotus Clinic"]);
    expect(listed.total).toBe(3);
  },
);

test("asked for all, every customer and refiller is listed", async () => {
  const { register } = await startWithParties();

  const listed = await register("show=all");

  expect(names(listed)).toEqual([
    "City Hospital",
    "Deccan Gases",
    "Lotus Clinic",
    "Metro Care",
    "New Ward",
  ]);
  expect(listed.parties[3]).toMatchObject({ gases: [], total: 0 });
});

test("the header counts the parties listed, the cylinders they hold and who is below zero", async () => {
  const { register, held } = await startWithParties();

  const listed = await register();

  expect(listed).toMatchObject({ summary: { held: 3, belowZero: 2 }, total: 3 });
  expect(listed.parties).toMatchObject([
    { gases: [held("Medical oxygen", 5)], total: 5 },
    { gases: [held("Medical oxygen", 5), held("Argon", -5)], total: 0 },
    { gases: [held("Argon", -2)], total: -2 },
  ]);
  expect(await register("show=all")).toMatchObject({
    summary: { held: 3, belowZero: 2 },
    total: 5,
  });
});

test.each([
  ["type=customer", ["City Hospital", "Lotus Clinic"], { held: 3, belowZero: 1 }],
  ["type=refiller", ["Deccan Gases"], { held: 0, belowZero: 1 }],
  ["search=cLiN", ["Lotus Clinic"], { held: -2, belowZero: 1 }],
  [
    "search=c&type=customer&show=all",
    ["City Hospital", "Lotus Clinic", "Metro Care"],
    { held: 3, belowZero: 1 },
  ],
  ["type=&search=", ["City Hospital", "Deccan Gases", "Lotus Clinic"], { held: 3, belowZero: 2 }],
])(
  "narrowed by '%s', the list and its header are of those parties",
  async (query, listed, summary) => {
    const { register } = await startWithParties();

    const narrowed = await register(query);

    expect(names(narrowed)).toEqual(listed);
    expect(narrowed).toMatchObject({ summary, total: listed.length });
  },
);

test("a search takes its characters as they are", async () => {
  const { register } = await startWithParties();

  expect(names(await register("search=%25&show=all"))).toEqual([]);
});

test.each([
  "type=supplier",
  "type=shop",
  "show=some",
  "date=yesterday",
  "date=2026-02-30",
  "date=2026-11-01&date=2026-11-02",
  "search=a&search=b",
  "page=0",
])("a query of '%s' is refused", async (query) => {
  const { get } = await start();

  const response = await get(`/api/reports/party-balance?${query}`);

  expect(response.statusCode).toBe(400);
});

test("a long list is paged, under a header for every page together", async () => {
  const { addParty, enter, register } = await start();
  for (let count = 1; count <= 51; count += 1) {
    const party = await addParty("customer", `Customer ${String(count).padStart(2, "0")}`);
    await enter(party.id, [{ gas: "Argon", quantity: 1 }]);
  }

  const first = await register();
  const second = await register("page=2");

  expect(first.parties).toHaveLength(50);
  expect(first).toMatchObject({ summary: { held: 51 }, total: 51, page: 1, pageSize: 50 });
  expect(names(second)).toEqual(["Customer 51"]);
  expect(second).toMatchObject({ summary: { held: 51 }, total: 51, page: 2 });
});

test("an inactive party is listed for the dates it held cylinders", async () => {
  const { addParty, dispatch, receive, against, deactivate, register } = await start();
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id, { date: "2026-11-10" });
  await receive(customer.id, [against(sent, "Medical oxygen", 5)], { date: "2026-11-20" });
  await deactivate(customer);

  expect(await register("date=2026-11-15")).toMatchObject({
    parties: [{ name: "City Hospital", active: false, total: 5 }],
  });
  expect(await register()).toMatchObject({ parties: [] });
  expect(await register("show=all")).toMatchObject({
    parties: [{ name: "City Hospital", active: false, total: 0 }],
  });
});

test("the register is read only when signed in", async () => {
  const { app } = await start();

  const response = await app.inject({ method: "GET", url: "/api/reports/party-balance" });

  expect(response.statusCode).toBe(401);
});
