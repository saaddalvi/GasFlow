import {
  billSchema,
  dailySummarySchema,
  partyHoldingSchema,
  pendingReturnListSchema,
} from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India. Here the records
// begin on 1 October, so that there is a month before this one.

/** The agency, with a customer and the means to read what a party's page shows. */
async function start() {
  const agency = await startAgency({ startDate: "2026-10-01" });
  const { get, gas } = agency;
  const customer = await agency.addParty("customer", "City Hospital");

  /** What the party holds, and what has moved this month. */
  async function holding(party: { id: string }) {
    const response = await get(`/api/parties/${party.id}/holding`);
    expect(response.statusCode).toBe(200);
    return partyHoldingSchema.parse(response.json());
  }

  /** So many cylinders of the named gas, as a holding lists them. */
  const held = (name: string, quantity: number) => ({
    gas: { id: gas(name).id, name },
    quantity,
  });

  /** One page of the party's days, for a query such as "from=2026-11-01". */
  async function dailySummary(party: { id: string }, query = "") {
    const response = await get(`/api/parties/${party.id}/daily-summary?${query}`);
    expect(response.statusCode).toBe(200);
    return dailySummarySchema.parse(response.json());
  }

  /** The ids on one page of the party's bills, for a query such as "status=posted". */
  async function billsOf(party: { id: string }, query = "") {
    const list = await agency.bills(`partyId=${party.id}&${query}`);
    return list.bills.map((bill) => bill.id);
  }

  /** One page of the customer's pending rows, for a query such as "page=2". */
  async function pendingOf(party: { id: string }, query = "") {
    const response = await get(`/api/reports/pending-returns?customerId=${party.id}&${query}`);
    expect(response.statusCode).toBe(200);
    return pendingReturnListSchema.parse(response.json());
  }

  return { ...agency, customer, holding, held, dailySummary, billsOf, pendingOf };
}

test("a party's holding is listed by gas, whatever the fill state", async () => {
  const { customer, enter, dispatch, receive, against, asLines, holding, held } = await start();
  await enter(customer.id, [{ gas: "Argon", quantity: 2 }]);
  const sent = await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 4 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  await receive(customer.id, [against(sent, "Medical oxygen", 3, { fillState: "defective" })]);

  expect(await holding(customer)).toMatchObject({
    // In the order the gases are listed in.
    gases: [held("Medical oxygen", 2), held("Argon", 2)],
    total: 4,
  });
});

test("a gas of which nothing is held is left out, and one below zero is not", async () => {
  const { addParty, send, refillerReturn, asLines, holding, held } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  await send(refiller.id);
  await refillerReturn(refiller.id, {
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 3 },
    ]),
  });

  expect(await holding(refiller)).toMatchObject({ gases: [held("Argon", -3)], total: -3 });
});

test("a customer's holding is what is pending less what is unmatched", async () => {
  const agency = await start();
  const { customer, dispatch, receive, unmatchedRow, cancel, customerWriteOff } = agency;
  const { holding, held, against } = agency;
  const returned = await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 2)] });
  const sent = await dispatch(customer.id);
  await customerWriteOff(customer.id, sent, "Medical oxygen", 1);

  expect(await holding(customer)).toMatchObject({
    gases: [held("Medical oxygen", 4), held("Argon", -2)],
    total: 2,
  });

  await receive(customer.id, [against(sent, "Medical oxygen", 4)]);
  await cancel(returned);

  expect(await holding(customer)).toMatchObject({ gases: [], total: 0 });
});

test("every posted bill counts towards what is held, even one dated after today", async () => {
  const { customer, dispatch, holding, held } = await start();
  await dispatch(customer.id, { date: "2026-11-28" });

  expect(await holding(customer)).toMatchObject({ gases: [held("Medical oxygen", 5)] });
});

test("this month counts what was sent and returned in it, of every gas", async () => {
  const agency = await start();
  const { customer, enter, dispatch, receive, unmatchedRow, cancel, against, asLines } = agency;
  await enter(customer.id, [{ gas: "Medical oxygen", quantity: 20 }]);
  // The last day of the month before.
  const old = await dispatch(customer.id, { date: "2026-10-31" });
  await receive(customer.id, [against(old, "Medical oxygen", 1)], { date: "2026-10-31" });
  const first = await dispatch(customer.id, {
    date: "2026-11-01",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 4 },
      { gas: "Argon", quantity: 3 },
    ]),
  });
  await dispatch(customer.id, { date: "2026-11-26" });
  // A return counts on its own date, whatever bill it is against, and what is
  // unmatched has come back too.
  await receive(customer.id, [against(old, "Medical oxygen", 2)], {
    unmatched: [unmatchedRow("Nitrogen", 1)],
  });
  await cancel(await dispatch(customer.id));
  await cancel(await receive(customer.id, [against(first, "Argon", 1)]));

  expect((await agency.holding(customer)).thisMonth).toEqual({
    from: "2026-11-01",
    to: "2026-11-30",
    sent: 12,
    returned: 3,
    netOut: 9,
  });
});

test("what is written off is neither sent nor returned", async () => {
  const { customer, dispatch, customerWriteOff, holding } = await start();
  const sent = await dispatch(customer.id);
  await customerWriteOff(customer.id, sent, "Medical oxygen", 2);

  expect(await holding(customer)).toMatchObject({
    total: 3,
    thisMonth: { sent: 5, returned: 0, netOut: 5 },
  });
});

test("a refiller is sent what is sent to it, and returns what comes back from it", async () => {
  const { addParty, send, refillerReturn, asLines, holding } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  await send(refiller.id);
  await refillerReturn(refiller.id, {
    lines: asLines([{ gas: "Medical oxygen", quantity: 7 }]),
  });

  expect((await holding(refiller)).thisMonth).toMatchObject({ sent: 5, returned: 7, netOut: -2 });
});

test("the month is the one it is in India", async () => {
  const { customer, clock, holding } = await start();
  clock.set("2026-11-30T18:29:59.999Z");
  expect((await holding(customer)).thisMonth).toMatchObject({
    from: "2026-11-01",
    to: "2026-11-30",
  });

  // Midnight there.
  clock.set("2026-11-30T18:30:00.000Z");
  expect((await holding(customer)).thisMonth).toMatchObject({
    from: "2026-12-01",
    to: "2026-12-31",
  });
});

test("a supplier holds nothing, whatever is added from it", async () => {
  const { addParty, admin, addCylindersFor, postBill, holding } = await start();
  const supplier = await addParty("supplier", "Sharp Cylinders");
  await postBill(addCylindersFor({ supplierId: supplier.id }), admin);

  expect(await holding(supplier)).toMatchObject({
    gases: [],
    total: 0,
    thisMonth: { sent: 0, returned: 0, netOut: 0 },
  });
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "not-an-id"])(
  "%s, which is no party, has no holding",
  async (partyId) => {
    const { get } = await start();

    const response = await get(`/api/parties/${partyId}/holding`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such party." });
  },
);

test("the shop's holding is not a party's", async () => {
  const { shop, get } = await start();

  const response = await get(`/api/parties/${shop.id}/holding`);

  expect(response.statusCode).toBe(404);
});

test("a party's holding is read only when signed in", async () => {
  const { app, customer } = await start();

  const response = await app.inject({
    method: "GET",
    url: `/api/parties/${customer.id}/holding`,
  });

  expect(response.statusCode).toBe(401);
});

test("the daily summary has a row for each day cylinders moved, the newest first", async () => {
  const agency = await start();
  const { customer, enter, dispatch, receive, unmatchedRow, cancel, customerWriteOff } = agency;
  const { against, asLines, gas, dailySummary } = agency;
  await enter(customer.id, [{ gas: "Medical oxygen", quantity: 20 }]);
  const first = await dispatch(customer.id, {
    date: "2026-11-12",
    lines: asLines([
      { gas: "Argon", quantity: 3 },
      { gas: "Medical oxygen", fillState: "filled", quantity: 3 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  await dispatch(customer.id, { date: "2026-11-12" });
  await receive(customer.id, [against(first, "Medical oxygen", 2)], {
    date: "2026-11-12",
    unmatched: [unmatchedRow("Nitrogen", 1)],
  });
  await receive(customer.id, [against(first, "Argon", 1)], { date: "2026-11-20" });
  // Neither of these is a day on which cylinders were sent or returned.
  await customerWriteOff(customer.id, first, "Argon", 1, { date: "2026-11-21" });
  await cancel(await dispatch(customer.id, { date: "2026-11-22" }));
  const moved = (name: string, sent: number, returned: number) => ({
    gas: { id: gas(name).id, name },
    sent,
    returned,
  });

  expect(await dailySummary(customer)).toEqual({
    days: [
      {
        date: "2026-11-20",
        sent: 0,
        returned: 1,
        netOut: -1,
        gases: [moved("Argon", 0, 1)],
      },
      {
        date: "2026-11-12",
        sent: 12,
        returned: 3,
        netOut: 9,
        // In the order the gases are listed in.
        gases: [moved("Medical oxygen", 9, 2), moved("Nitrogen", 0, 1), moved("Argon", 3, 0)],
      },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  });
});

test.each([
  ["from a date on", "from=2026-11-12", ["2026-11-20", "2026-11-12"]],
  ["up to a date", "to=2026-11-12", ["2026-11-12", "2026-10-31"]],
  ["between two dates", "from=2026-11-12&to=2026-11-12", ["2026-11-12"]],
  ["between dates the wrong way round", "from=2026-11-20&to=2026-11-12", []],
  [
    "by blank dates, which ask for every day",
    "from=&to=",
    ["2026-11-20", "2026-11-12", "2026-10-31"],
  ],
])("the daily summary can be narrowed %s", async (_case, query, dates) => {
  const { customer, dispatch, dailySummary } = await start();
  for (const date of ["2026-10-31", "2026-11-12", "2026-11-20"]) {
    await dispatch(customer.id, { date });
  }

  const summary = await dailySummary(customer, query);

  expect(summary.days.map((day) => day.date)).toEqual(dates);
  expect(summary.total).toBe(dates.length);
});

test("a long daily summary comes a page at a time", async () => {
  const { customer, dispatch, dailySummary } = await start();
  const dates = Array.from({ length: 51 }, (_, i) =>
    new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
  );
  for (const date of dates) {
    await dispatch(customer.id, { date });
  }

  const first = await dailySummary(customer);
  const second = await dailySummary(customer, "page=2");

  expect([...first.days, ...second.days].map((day) => day.date)).toEqual(dates.toReversed());
  expect([first.days.length, second.days.length]).toEqual([50, 1]);
  expect([first.total, second.total]).toEqual([51, 51]);
});

test("a refiller's daily summary has what was sent to it and returned by it", async () => {
  const { addParty, send, refillerReturn, dailySummary } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  await send(refiller.id, { date: "2026-11-12" });
  await refillerReturn(refiller.id, { date: "2026-11-20" });

  expect((await dailySummary(refiller)).days).toMatchObject([
    { date: "2026-11-20", sent: 0, returned: 5, netOut: -5 },
    { date: "2026-11-12", sent: 5, returned: 0, netOut: 5 },
  ]);
});

test.each([
  ["from=yesterday", "Choose a date."],
  ["to=2026-13-01", "Choose a date."],
  ["page=0", "There is no such page."],
])("a daily summary asked for %s is refused", async (query, message) => {
  const { customer, get } = await start();

  const response = await get(`/api/parties/${customer.id}/daily-summary?${query}`);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});

test("there is no daily summary for the shop", async () => {
  const { shop, get } = await start();

  const response = await get(`/api/parties/${shop.id}/daily-summary`);

  expect(response.statusCode).toBe(404);
  expect(response.json()).toMatchObject({ message: "There is no such party." });
});

test("a party's bills are those that name it, active, cancelled or all", async () => {
  const agency = await start();
  const { customer, addParty, enter, dispatch, receive, against, cancel, billsOf } = agency;
  // A name that has the other's in it, which the party filter would also find.
  const other = await addParty("customer", "City Hospital Annexe");
  await dispatch(other.id);
  const opening = await enter(customer.id, [{ gas: "Argon", quantity: 2 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-12" });
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
    date: "2026-11-20",
  });
  const wrong = await dispatch(customer.id, { date: "2026-11-21" });
  await cancel(wrong);

  expect(await billsOf(customer)).toEqual([wrong.id, returned.id, sent.id, opening.id]);
  expect(await billsOf(customer, "status=posted")).toEqual([returned.id, sent.id, opening.id]);
  expect(await billsOf(customer, "status=cancelled")).toEqual([wrong.id]);
  expect(await billsOf(customer, "from=2026-11-12&to=2026-11-20")).toEqual([returned.id, sent.id]);
  // Together with a name, a bill has to meet both.
  expect(await billsOf(customer, "party=annexe")).toEqual([]);
});

test.each([
  ["a refiller", "refiller"],
  ["a supplier", "supplier"],
] as const)("the bills of %s are those that name it", async (_case, type) => {
  const { addParty, admin, send, addCylindersFor, postBill, billsOf, dispatch, customer } =
    await start();
  const party = await addParty(type, "Zenith Gases");
  await dispatch(customer.id);
  const bill =
    type === "refiller"
      ? await send(party.id)
      : billSchema.parse((await postBill(addCylindersFor({ supplierId: party.id }), admin)).json());

  expect(await billsOf(party)).toEqual([bill.id]);
});

test("a bill list asked for something that is no party is refused", async () => {
  const { get } = await start();

  const response = await get("/api/bills?partyId=not-an-id");

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Choose a party." });
});

test("a deactivated party's history stays readable", async () => {
  const agency = await start();
  const { app, staff, customer, dispatch, receive, against, holding, billsOf } = agency;
  const sent = await dispatch(customer.id, { date: "2026-11-12" });
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 5)]);
  const deactivated = await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { active: false },
  });
  expect(deactivated.statusCode).toBe(200);

  expect(await billsOf(customer)).toEqual([returned.id, sent.id]);
  expect((await agency.viewBill(sent.id)).to).toMatchObject({ id: customer.id });
  expect(await holding(customer)).toMatchObject({ thisMonth: { sent: 5, returned: 5 } });
  expect((await agency.dailySummary(customer)).days).toMatchObject([
    { date: "2026-11-26", returned: 5 },
    { date: "2026-11-12", sent: 5 },
  ]);
});

test("a customer's pending bills are listed alone, the longest out first", async () => {
  const { customer, addParty, enter, dispatch, receive, against, pendingOf } = await start();
  const other = await addParty("customer", "Lotus Clinic");
  await dispatch(other.id, { date: "2026-10-05" });
  const opening = await enter(customer.id, [{ gas: "Argon", quantity: 2 }]);
  const old = await dispatch(customer.id, { date: "2026-10-20" });
  const returned = await dispatch(customer.id, { date: "2026-11-01" });
  await receive(customer.id, [against(returned, "Medical oxygen", 5)]);
  const recent = await dispatch(customer.id, { date: "2026-11-20" });

  // The limit is 30 days.
  expect(await pendingOf(customer)).toMatchObject({
    rows: [
      { bill: { id: opening.id }, pending: 2, daysOut: 56, overdue: true },
      { bill: { id: old.id }, pending: 5, daysOut: 37, overdue: true },
      { bill: { id: recent.id }, pending: 5, daysOut: 6, overdue: false },
    ],
    total: 3,
    page: 1,
  });
});

test("a customer's long pending list comes a page at a time", async () => {
  const { customer, addParty, dispatch, pendingOf } = await start();
  await dispatch((await addParty("customer", "Lotus Clinic")).id);
  for (let count = 0; count < 51; count += 1) {
    await dispatch(customer.id);
  }

  const second = await pendingOf(customer, "page=2");

  expect([second.rows.length, second.total]).toEqual([1, 51]);
});

test("a customer's unmatched returns are listed alone", async () => {
  const { customer, addParty, receive, unmatchedRow, unmatchedList } = await start();
  const other = await addParty("customer", "Lotus Clinic");
  await receive(other.id, [], { unmatched: [unmatchedRow("Argon", 1)] });
  const returned = await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 2)] });

  expect(await unmatchedList(`customerId=${customer.id}`)).toMatchObject({
    rows: [{ return: { id: returned.id }, customer: { id: customer.id }, quantity: 2 }],
    total: 1,
  });
});

test.each(["pending-returns", "unmatched"])(
  "the %s list cannot be narrowed to something that is no customer",
  async (list) => {
    const { get } = await start();
    const path = list === "unmatched" ? "returns/unmatched" : "reports/pending-returns";

    const response = await get(`/api/${path}?customerId=not-an-id`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Choose a customer." });
  },
);
