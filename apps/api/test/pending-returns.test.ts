import { pendingReturnListSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India, and the records
// begin on 1 November.

/** The agency, with a customer who has cylinders to bring back. */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");

  /** One page of the pending returns, for a query such as "page=2". */
  async function pendingReturns(query = "") {
    const response = await agency.get(`/api/reports/pending-returns?${query}`);
    expect(response.statusCode).toBe(200);
    return pendingReturnListSchema.parse(response.json());
  }

  return { ...agency, customer, pendingReturns };
}

test("every pending bill and gas is listed with its customer, the longest out first", async () => {
  const { customer, addParty, enter, dispatch, asLines, gas, pendingReturns } = await start();
  const clinic = await addParty("customer", "Apex Clinic");
  const newest = await dispatch(customer.id, { number: "1234", date: "2026-11-20" });
  const older = await dispatch(clinic.id, {
    paperKind: "cash_memo",
    number: "88",
    date: "2026-11-12",
    // Two lines of one gas make one row.
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 4 },
      { gas: "Argon", quantity: 2 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  const opening = await enter(customer.id, [{ gas: "Nitrogen", quantity: 7 }]);
  const row = (
    party: typeof customer,
    bill: typeof opening,
    name: string,
    pending: number,
    daysOut: number,
  ) => ({
    customer: { id: party.id, name: party.name, active: true },
    bill: {
      id: bill.id,
      type: bill.type,
      paperKind: bill.paperKind,
      number: bill.number,
      date: bill.date,
    },
    gas: { id: gas(name).id, name },
    sent: pending,
    returned: 0,
    writtenOff: 0,
    pending,
    daysOut,
    overdue: false,
  });

  expect(await pendingReturns()).toEqual({
    rows: [
      // Opening stock is dated the start date, and counts its days from it.
      row(customer, opening, "Nitrogen", 7, 25),
      row(clinic, older, "Medical oxygen", 5, 14),
      row(clinic, older, "Argon", 2, 14),
      row(customer, newest, "Medical oxygen", 5, 6),
    ],
    total: 4,
    page: 1,
    pageSize: 50,
  });
  expect(opening.date).toBe(START_DATE);
});

test("cylinders are not overdue on the day they reach the limit, and are the day after", async () => {
  const { customer, enter, dispatch, clock, pendingReturns, pending } = await start();
  await dispatch(customer.id, { date: "2026-11-02" });
  await enter(customer.id, [{ gas: "Nitrogen", quantity: 7 }]);
  /** The days out and the highlighting each list gives, the longest out first. */
  async function daysOutListed(date: string) {
    const listed = [(await pendingReturns()).rows, await pending(customer.id, date)];
    return listed.map((rows) => rows.map(({ daysOut, overdue }) => [daysOut, overdue]));
  }

  // 30 days after the start date, which is 29 after the dispatch.
  clock.set("2026-12-01T06:30:00.000Z");
  const onTheLimit = [
    [30, false],
    [29, false],
  ];
  expect(await daysOutListed("2026-12-01")).toEqual([onTheLimit, onTheLimit]);

  // The last moment of that day in India, and then midnight there.
  clock.set("2026-12-01T18:29:59.999Z");
  expect(await daysOutListed("2026-12-01")).toEqual([onTheLimit, onTheLimit]);
  clock.set("2026-12-01T18:30:00.000Z");
  const theDayAfter = [
    [31, true],
    [30, false],
  ];
  expect(await daysOutListed("2026-12-02")).toEqual([theDayAfter, theDayAfter]);
});

test("changing the overdue limit changes what is highlighted at once", async () => {
  const { admin, app, customer, dispatch, pendingReturns, pending } = await start();
  await dispatch(customer.id, { date: "2026-11-12" });
  await dispatch(customer.id, { date: "2026-11-20" });
  /** Which rows each list highlights, for cylinders 14 and 6 days out. */
  async function highlighted() {
    const listed = [(await pendingReturns()).rows, await pending(customer.id)];
    return listed.map((rows) => rows.map(({ overdue }) => overdue));
  }
  async function limit(days: number) {
    const response = await app.inject({
      method: "PUT",
      url: "/api/overdue-limit",
      headers: admin.headers,
      payload: { days },
    });
    expect(response.statusCode).toBe(200);
  }
  const both = (rows: boolean[]) => [rows, rows];

  expect(await highlighted()).toEqual(both([false, false]));
  await limit(13);
  expect(await highlighted()).toEqual(both([true, false]));
  await limit(5);
  expect(await highlighted()).toEqual(both([true, true]));
  await limit(14);
  expect(await highlighted()).toEqual(both([false, false]));
});

test("days out are counted to today, whatever date a return is being entered for", async () => {
  const { customer, dispatch, clock, pending } = await start();
  await dispatch(customer.id, { date: "2026-11-02" });
  clock.set("2026-12-02T06:30:00.000Z");

  // Only 8 days after the bill, but the cylinders have been out for 30.
  expect(await pending(customer.id, "2026-11-10")).toMatchObject([{ daysOut: 30, overdue: false }]);

  clock.set("2026-12-03T06:30:00.000Z");

  expect(await pending(customer.id, "2026-11-10")).toMatchObject([{ daysOut: 31, overdue: true }]);
});

test("a row shows only the quantity still pending, and goes once nothing is", async () => {
  const {
    customer,
    dispatch,
    asLines,
    receive,
    against,
    customerWriteOff,
    cancel,
    pendingReturns,
  } = await start();
  const sent = await dispatch(customer.id, {
    date: "2026-11-12",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  const cancelled = await dispatch(customer.id, { date: "2026-11-13" });
  await cancel(cancelled);
  const returned = await receive(customer.id, [
    against(sent, "Medical oxygen", 3),
    against(sent, "Argon", 2),
  ]);
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 1);

  expect(await pendingReturns()).toMatchObject({
    total: 1,
    rows: [{ gas: { name: "Medical oxygen" }, sent: 5, returned: 3, writtenOff: 1, pending: 1 }],
  });

  await cancel(writtenOff);
  await cancel(returned);

  expect(await pendingReturns()).toMatchObject({
    total: 2,
    rows: [
      { gas: { name: "Medical oxygen" }, pending: 5 },
      { gas: { name: "Argon" }, pending: 2 },
    ],
  });
});

test("only cylinders that customers hold are pending returns", async () => {
  const { shop, addParty, enter, send, pendingReturns } = await start();
  const refiller = await addParty("refiller", "Deccan Gases");
  await enter(shop.id, [{ gas: "Argon", quantity: 3 }]);
  await enter(refiller.id, [{ gas: "Argon", quantity: 2 }]);
  await send(refiller.id);

  expect(await pendingReturns()).toEqual({ rows: [], total: 0, page: 1, pageSize: 50 });
});

test("an inactive customer's pending cylinders are still listed, marked inactive", async () => {
  const { app, staff, customer, dispatch, pendingReturns } = await start();
  await dispatch(customer.id);
  const response = await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { active: false },
  });
  expect(response.statusCode).toBe(200);

  expect((await pendingReturns()).rows).toMatchObject([
    { customer: { id: customer.id, active: false }, pending: 5 },
  ]);
});

test("a bill dated after today is listed last, with no days out", async () => {
  const { customer, dispatch, pendingReturns } = await start();
  const future = await dispatch(customer.id, { date: "2026-11-28" });
  const past = await dispatch(customer.id, { date: "2026-11-25" });

  expect((await pendingReturns()).rows).toMatchObject([
    { bill: { id: past.id }, daysOut: 1 },
    { bill: { id: future.id }, daysOut: 0, overdue: false },
  ]);
});

test("the list comes a page of 50 rows at a time", async () => {
  const { customer, dispatch, pendingReturns } = await start();
  // The oldest is entered first, and each later bill is a day newer or the same.
  const oldest = await dispatch(customer.id, { date: "2026-11-02" });
  for (let day = 0; day < 49; day += 1) {
    await dispatch(customer.id, { date: "2026-11-10" });
  }
  const newest = await dispatch(customer.id, { date: "2026-11-20" });

  const first = await pendingReturns();
  expect(first).toMatchObject({ total: 51, page: 1, pageSize: 50 });
  expect(first.rows).toHaveLength(50);
  expect(first.rows[0]?.bill.id).toBe(oldest.id);
  expect(await pendingReturns("page=2")).toMatchObject({
    total: 51,
    page: 2,
    rows: [{ bill: { id: newest.id } }],
  });
  expect(await pendingReturns("page=3")).toMatchObject({ total: 51, rows: [] });
});

test.each(["page=0", "page=one", "page=1.5"])(
  "a page that cannot be is refused: %s",
  async (query) => {
    const { get } = await start();

    const response = await get(`/api/reports/pending-returns?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "There is no such page." });
  },
);

test("someone signed out cannot see the pending returns", async () => {
  const { app } = await start();

  const response = await app.inject({ method: "GET", url: "/api/reports/pending-returns" });

  expect(response.statusCode).toBe(401);
});
