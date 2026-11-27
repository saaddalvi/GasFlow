import { balanceRegisterSchema, dashboardSchema, pendingReturnListSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

// The clock stands at noon in India on Thursday 26 November 2026.
const TODAY = "2026-11-26";

/** An agency whose records go back far enough to compare with, and its dashboard. */
async function startDashboard({ startDate = "2026-09-01" }: { startDate?: string | null } = {}) {
  const agency = await startAgency({ startDate });

  /** The dashboard staff see. */
  async function dashboard() {
    const response = await agency.get("/api/dashboard");
    expect(response.statusCode).toBe(200);
    return dashboardSchema.parse(response.json());
  }

  /** So many cylinders of the named gas on one line. */
  const some = (gas: string, quantity: number) => agency.asLines([{ gas, quantity }]);

  return { ...agency, dashboard, some };
}

test("dispatched today adds up today's dispatch bills, by gas, and counts their customers", async () => {
  const { addParty, asLines, dispatch, held, some, dashboard } = await startDashboard();
  const hospital = await addParty("customer", "City Hospital");
  const works = await addParty("customer", "Steel Works");
  await dispatch(hospital.id, {
    lines: asLines([
      { gas: "Argon", quantity: 2 },
      { gas: "Medical oxygen", quantity: 5 },
    ]),
  });
  // A second bill to one customer counts them once.
  await dispatch(hospital.id, { lines: some("Medical oxygen", 3) });
  await dispatch(works.id, { lines: some("Argon", 4) });
  // Neither yesterday's nor tomorrow's is today's.
  await dispatch(works.id, { date: "2026-11-25" });
  await dispatch(works.id, { date: "2026-11-27" });

  const { date, dispatched } = await dashboard();

  expect(date).toBe(TODAY);
  expect(dispatched.quantity).toBe(14);
  expect(dispatched.customers).toBe(2);
  expect(dispatched.gases).toEqual([held("Medical oxygen", 8), held("Argon", 6)]);
});

test("today's dispatches are compared with the same weekday last week", async () => {
  const { addParty, dispatch, some, dashboard } = await startDashboard();
  const { id } = await addParty("customer", "City Hospital");
  await dispatch(id, { date: "2026-11-19", lines: some("Medical oxygen", 3) });
  await dispatch(id, { date: "2026-11-19", lines: some("Argon", 4) });
  // The days either side of it are not the same weekday.
  await dispatch(id, { date: "2026-11-18" });
  await dispatch(id, { date: "2026-11-20" });

  const { dispatched } = await dashboard();

  expect(dispatched.quantity).toBe(0);
  expect(dispatched.lastWeek).toEqual({ date: "2026-11-19", quantity: 7 });
});

test("the last seven days are each counted, today last", async () => {
  const { addParty, dispatch, some, dashboard } = await startDashboard();
  const { id } = await addParty("customer", "City Hospital");
  // Eight days ago, which is left off.
  await dispatch(id, { date: "2026-11-19", lines: some("Medical oxygen", 1) });
  await dispatch(id, { date: "2026-11-20", lines: some("Medical oxygen", 2) });
  await dispatch(id, { date: "2026-11-24", lines: some("Medical oxygen", 3) });
  await dispatch(id, { date: TODAY, lines: some("Argon", 4) });

  const { dispatched } = await dashboard();

  expect(dispatched.days).toEqual([
    { date: "2026-11-20", quantity: 2 },
    { date: "2026-11-21", quantity: 0 },
    { date: "2026-11-22", quantity: 0 },
    { date: "2026-11-23", quantity: 0 },
    { date: "2026-11-24", quantity: 3 },
    { date: "2026-11-25", quantity: 0 },
    { date: "2026-11-26", quantity: 4 },
  ]);
});

test("the month to date is compared with last month up to the same day", async () => {
  const { addParty, dispatch, some, dashboard } = await startDashboard();
  const { id } = await addParty("customer", "City Hospital");
  const sent = (date: string, quantity: number) =>
    dispatch(id, { date, lines: some("Medical oxygen", quantity) });
  await sent("2026-09-30", 1);
  await sent("2026-10-01", 2);
  await sent("2026-10-26", 4);
  await sent("2026-10-27", 8);
  await sent("2026-10-31", 16);
  await sent("2026-11-01", 32);
  await sent(TODAY, 64);
  // A bill dated after today is not yet part of the month to date.
  await sent("2026-11-27", 128);

  const { dispatched } = await dashboard();

  expect(dispatched.thisMonth).toEqual({ from: "2026-11-01", to: TODAY, quantity: 96 });
  expect(dispatched.lastMonth).toEqual({ from: "2026-10-01", to: "2026-10-26", quantity: 6 });
});

test.each([
  // Noon in India on a day that last month does not have, so all of it is compared.
  ["2027-03-31T06:30:00.000Z", "2027-03-01", "2027-02-01", "2027-02-28"],
  ["2028-03-30T06:30:00.000Z", "2028-03-01", "2028-02-01", "2028-02-29"],
  // January is compared with the December of the year before.
  ["2027-01-05T06:30:00.000Z", "2027-01-01", "2026-12-01", "2026-12-05"],
  // Just after midnight in India, while it is still November in UTC.
  ["2026-11-30T18:30:00.000Z", "2026-12-01", "2026-11-01", "2026-11-01"],
])("at %s the month began on %s and is compared with %s to %s", async (now, first, from, to) => {
  const { clock, dashboard } = await startDashboard();
  clock.set(now);

  const { dispatched } = await dashboard();

  expect(dispatched.thisMonth.from).toBe(first);
  expect(dispatched.lastMonth).toMatchObject({ from, to });
});

test("received from customers counts today's returns, matched or not, and net out takes them off", async () => {
  const agency = await startDashboard();
  const { addParty, asLines, dispatch, receive, against, unmatchedRow, held, dashboard } = agency;
  const { id } = await addParty("customer", "City Hospital");
  const sent = await dispatch(id, {
    date: "2026-11-20",
    lines: asLines([{ gas: "Medical oxygen", quantity: 10 }]),
  });
  await receive(id, [against(sent, "Medical oxygen", 1)], { date: "2026-11-25" });
  await receive(id, [against(sent, "Medical oxygen", 3)]);
  // Nothing of this gas is pending, so these are unmatched.
  await receive(id, [], { unmatched: [unmatchedRow("Argon", 2)] });
  await dispatch(id, { lines: asLines([{ gas: "Nitrogen", quantity: 4 }]) });

  const { received, netOut } = await dashboard();

  expect(received).toEqual({
    quantity: 5,
    gases: [held("Medical oxygen", 3), held("Argon", 2)],
  });
  expect(netOut).toBe(-1);
});

test("what went to refillers today and what came back are counted apart", async () => {
  const { addParty, send, refillerReturn, dashboard } = await startDashboard();
  const { id } = await addParty("refiller", "Zenith Gases");
  await send(id);
  await send(id);
  await refillerReturn(id);
  await send(id, { date: "2026-11-25" });
  await refillerReturn(id, { date: "2026-11-25" });

  const { refillerMovements, dispatched, received } = await dashboard();

  expect(refillerMovements).toEqual({ sent: 10, received: 5 });
  // A refiller is no customer, so nothing was dispatched or received from one.
  expect(dispatched.quantity).toBe(0);
  expect(received.quantity).toBe(0);
});

test("opening stock is never today's movement, even on the start date", async () => {
  const { shop, addParty, enter, dashboard } = await startDashboard({ startDate: TODAY });
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);
  await enter(customer.id, [{ gas: "Medical oxygen", quantity: 8 }]);
  await enter(refiller.id, [{ gas: "Medical oxygen", quantity: 6 }]);

  const { dispatched, received, netOut, refillerMovements } = await dashboard();

  expect(dispatched).toMatchObject({ quantity: 0, customers: 0, gases: [] });
  expect(dispatched.days.map((day) => day.quantity)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect(dispatched.thisMonth.quantity).toBe(0);
  expect(received).toEqual({ quantity: 0, gases: [] });
  expect(netOut).toBe(0);
  expect(refillerMovements).toEqual({ sent: 0, received: 0 });
});

test("cancelled bills and other types of bill are left out of today's movement", async () => {
  const agency = await startDashboard();
  const { addParty, dispatch, send, cancel, receive, against, dashboard } = agency;
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  const kept = await dispatch(customer.id, { date: "2026-11-20" });
  const { id } = await receive(customer.id, [against(kept, "Medical oxygen", 2)]);
  await cancel({ id });
  await cancel(await dispatch(customer.id));
  await cancel(await send(refiller.id));
  await agency.customerWriteOff(customer.id, kept, "Medical oxygen", 1);
  const added = await agency.postBill(agency.addCylindersFor(), agency.admin);
  expect(added.statusCode).toBe(201);

  const { dispatched, received, refillerMovements } = await dashboard();

  expect(dispatched).toMatchObject({ quantity: 0, customers: 0, gases: [] });
  expect(dispatched.thisMonth.quantity).toBe(5);
  expect(received.quantity).toBe(0);
  expect(refillerMovements).toEqual({ sent: 0, received: 0 });
});

test("bills entered counts what was entered today in India, with when the last one was", async () => {
  const { clock, shop, addParty, enter, dispatch, send, cancel, bills, dashboard } =
    await startDashboard();
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Zenith Gases");
  // The last moment of the 25th in India.
  clock.set("2026-11-25T18:29:59.999Z");
  await dispatch(customer.id);
  // The 26th there: one back-dated, one dated today, and opening stock.
  clock.set("2026-11-25T18:30:00.000Z");
  await dispatch(customer.id, { date: "2026-11-02" });
  clock.set("2026-11-26T04:00:00.000Z");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);
  clock.set("2026-11-26T05:15:00.000Z");
  await send(refiller.id);
  // A bill cancelled counts for nothing, however lately it was entered.
  clock.set("2026-11-26T06:00:00.000Z");
  await cancel(await dispatch(customer.id));

  const { date, billsEntered } = await dashboard();

  expect(billsEntered).toEqual({ count: 3, lastEnteredAt: "2026-11-26T05:15:00.000Z" });
  // The list it links to has those bills.
  expect((await bills(`enteredOn=${date}&status=posted`)).total).toBe(3);
});

test("before any bill is entered today there is no last entry time", async () => {
  const { dashboard } = await startDashboard();

  expect((await dashboard()).billsEntered).toEqual({ count: 0, lastEnteredAt: null });
});

test("cylinders are counted at the shop by fill state, with customers and at refillers", async () => {
  const agency = await startDashboard();
  const { shop, addParty, asLines, enter, dispatch, send, report, dashboard } = agency;
  const hospital = await addParty("customer", "City Hospital");
  const works = await addParty("customer", "Steel Works");
  const refiller = await addParty("refiller", "Zenith Gases");
  // Holds nothing, so is not counted among those who hold cylinders.
  await addParty("customer", "Lake Clinic");
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 40 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 10 },
    { gas: "Argon", fillState: "defective", quantity: 2 },
  ]);
  await enter(hospital.id, [{ gas: "Argon", quantity: 3 }]);
  await dispatch(works.id, { lines: asLines([{ gas: "Medical oxygen", quantity: 5 }]) });
  await send(refiller.id, {
    lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 4 }]),
  });
  // Not yet where it will be.
  await dispatch(works.id, { date: "2026-11-27" });

  const { cylinders } = await dashboard();

  expect(cylinders).toMatchObject({
    total: 55,
    shop: { filled: 35, empty: 6, defective: 2, total: 43 },
    customers: { held: 8, parties: 2 },
    refillers: { held: 4, parties: 1 },
  });
  // Gas by gas, it is the stock report for today.
  expect(cylinders.gases).toEqual((await report()).rows);
});

test("until the start date is set there are no cylinders to count", async () => {
  const { dashboard } = await startDashboard({ startDate: null });

  const { startDate, cylinders } = await dashboard();

  expect(startDate).toBeNull();
  expect(cylinders).toEqual({
    total: 0,
    shop: { filled: 0, empty: 0, defective: 0, total: 0 },
    customers: { held: 0, parties: 0 },
    refillers: { held: 0, parties: 0 },
    gases: [],
  });
});

test("a customer whose gases cancel each other out still counts as one with cylinders", async () => {
  const agency = await startDashboard();
  const { addParty, asLines, dispatch, receive, unmatchedRow, dashboard } = agency;
  const { id } = await addParty("customer", "City Hospital");
  await dispatch(id, { lines: asLines([{ gas: "Medical oxygen", quantity: 2 }]) });
  await receive(id, [], { unmatched: [unmatchedRow("Argon", 2)] });

  const { cylinders } = await dashboard();

  expect(cylinders.customers).toEqual({ held: 0, parties: 1 });
});

test("pending returns counts the cylinders, their customers and the cylinders overdue", async () => {
  const agency = await startDashboard();
  const { app, admin, addParty, asLines, enter, dispatch, receive, against, dashboard, get } =
    agency;
  const hospital = await addParty("customer", "City Hospital");
  const works = await addParty("customer", "Steel Works");
  const clinic = await addParty("customer", "Lake Clinic");
  // Out since the start date, 86 days ago.
  await enter(hospital.id, [{ gas: "Argon", quantity: 2 }]);
  // 31 days out, which is over the limit of 30, and 30 days out, which is not.
  const old = await dispatch(works.id, {
    date: "2026-10-26",
    lines: asLines([{ gas: "Medical oxygen", quantity: 5 }]),
  });
  await dispatch(works.id, {
    date: "2026-10-27",
    lines: asLines([{ gas: "Medical oxygen", quantity: 7 }]),
  });
  await receive(works.id, [against(old, "Medical oxygen", 1)]);
  // All of this comes back, so its customer has nothing pending.
  const cleared = await dispatch(clinic.id, { date: "2026-10-01" });
  await receive(clinic.id, [against(cleared, "Medical oxygen", 5)]);

  expect((await dashboard()).pendingReturns).toEqual({ quantity: 13, customers: 2, overdue: 6 });
  // The list it links to has those cylinders.
  const list = pendingReturnListSchema.parse((await get("/api/reports/pending-returns")).json());
  expect(list.rows.map((row) => [row.pending, row.overdue])).toEqual([
    [2, true],
    [4, true],
    [7, false],
  ]);

  const response = await app.inject({
    method: "PUT",
    url: "/api/overdue-limit",
    headers: admin.headers,
    payload: { days: 29 },
  });
  expect(response.statusCode).toBe(200);

  expect((await dashboard()).pendingReturns).toEqual({ quantity: 13, customers: 2, overdue: 13 });
});

test("with nothing pending, the pending returns figures are all none", async () => {
  const { dashboard } = await startDashboard();

  expect((await dashboard()).pendingReturns).toEqual({ quantity: 0, customers: 0, overdue: 0 });
});

test("counts below zero are counted at the shop and with parties", async () => {
  const agency = await startDashboard();
  const { addParty, asLines, dispatch, receive, unmatchedRow, refillerReturn, dashboard, get } =
    agency;
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Lake Clinic");
  const refiller = await addParty("refiller", "Zenith Gases");
  // The shop has none to send, so its filled oxygen is below zero.
  await dispatch(clinic.id);
  // Two gases come back from a customer who had neither. The shop gains them.
  await receive(hospital.id, [], {
    unmatched: [unmatchedRow("Argon", 2), unmatchedRow("Nitrogen", 1)],
  });
  // Filled nitrogen comes from a refiller who was sent none.
  await refillerReturn(refiller.id, { lines: asLines([{ gas: "Nitrogen", quantity: 3 }]) });
  // A second fill state of a gas at the shop, below zero by itself.
  await dispatch(clinic.id, {
    lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 1 }]),
  });
  // A bill dated after today has taken nothing yet.
  await dispatch(clinic.id, {
    date: "2026-11-27",
    lines: asLines([{ gas: "Hydrogen", quantity: 1 }]),
  });

  const { belowZero } = await dashboard();

  // The hospital's argon and nitrogen, and the refiller's nitrogen.
  expect(belowZero).toEqual({ shop: 2, parties: 3 });
  // The list it links to has those parties.
  const listed = balanceRegisterSchema.parse(
    (await get("/api/reports/party-balance?show=below_zero")).json(),
  );
  expect(listed.parties.map((party) => party.name)).toEqual(["City Hospital", "Zenith Gases"]);
});

test("with no count below zero, there are none at the shop or with parties", async () => {
  const { shop, addParty, enter, dispatch, dashboard } = await startDashboard();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 5 }]);
  await dispatch(customer.id);

  expect((await dashboard()).belowZero).toEqual({ shop: 0, parties: 0 });
});

test("the dashboard is read only when signed in", async () => {
  const { app } = await startDashboard();

  const response = await app.inject({ method: "GET", url: "/api/dashboard" });

  expect(response.statusCode).toBe(401);
});
