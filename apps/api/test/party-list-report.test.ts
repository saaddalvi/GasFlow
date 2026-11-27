import { partyReportSchema, partySchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India, and the records
// begin on 1 November.

/** The agency, with the means to read the party list as its page shows it. */
async function start() {
  const agency = await startAgency();
  const { app, staff, get, gas } = agency;

  /** One page of the party list, for a query such as "type=customer". */
  async function partyReport(query = "") {
    const response = await get(`/api/reports/parties?${query}`);
    expect(response.statusCode).toBe(200);
    return partyReportSchema.parse(response.json());
  }

  /** So many cylinders of the named gas, as a holding lists them. */
  const held = (name: string, quantity: number) => ({
    gas: { id: gas(name).id, name },
    quantity,
  });

  async function deactivate(party: { id: string }) {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/parties/${party.id}`,
      headers: staff.headers,
      payload: { active: false },
    });
    expect(response.statusCode).toBe(200);
    return partySchema.parse(response.json());
  }

  return { ...agency, partyReport, held, deactivate };
}

const NONE = {
  active: { customer: 0, refiller: 0, supplier: 0 },
  withCustomers: 0,
  atRefillers: 0,
  belowZero: 0,
};

test("each party is listed by name with what it holds now and its last bill", async () => {
  const agency = await start();
  const { addParty, enter, dispatch, admin, addCylindersFor, postBill } = agency;
  const { partyReport, held } = agency;
  const supplier = await addParty("supplier", "Sharp Cylinders");
  const refiller = await addParty("refiller", "Deccan Gases");
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Argon", quantity: 2 }]);
  const sent = await dispatch(customer.id, { number: "1234", date: "2026-11-20" });
  // Entered later, but dated earlier.
  await dispatch(customer.id, { date: "2026-11-12" });
  const added = (await postBill(addCylindersFor({ supplierId: supplier.id }), admin)).json<{
    id: string;
    number: string;
  }>();

  expect(await partyReport()).toEqual({
    parties: [
      {
        ...customer,
        holding: { gases: [held("Medical oxygen", 10), held("Argon", 2)], total: 12 },
        lastBill: {
          id: sent.id,
          type: "dispatch",
          paperKind: "bill",
          number: "1234",
          date: "2026-11-20",
        },
      },
      { ...refiller, holding: { gases: [], total: 0 }, lastBill: null },
      {
        ...supplier,
        // A supplier's cylinders are not counted.
        holding: null,
        lastBill: {
          id: added.id,
          type: "add_cylinders",
          paperKind: null,
          number: added.number,
          date: "2026-11-26",
        },
      },
    ],
    summary: {
      active: { customer: 1, refiller: 1, supplier: 1 },
      withCustomers: 12,
      atRefillers: 0,
      belowZero: 0,
    },
    total: 3,
    page: 1,
    pageSize: 50,
  });
});

test("a cancelled bill is nobody's last bill", async () => {
  const { addParty, dispatch, cancel, partyReport } = await start();
  const customer = await addParty("customer", "City Hospital");
  const kept = await dispatch(customer.id, { date: "2026-11-12" });
  await cancel(await dispatch(customer.id, { date: "2026-11-20" }));

  expect((await partyReport()).parties).toMatchObject([
    { lastBill: { id: kept.id }, holding: { total: 5 } },
  ]);
});

test("of two bills on one date, the one entered later is the last", async () => {
  const { addParty, dispatch, receive, against, clock, partyReport } = await start();
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id);
  clock.set("2026-11-26T07:00:00.000Z");
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 1)]);

  expect((await partyReport()).parties).toMatchObject([{ lastBill: { id: returned.id } }]);
});

test("the summary adds up what customers and refillers hold, and who is below zero", async () => {
  const agency = await start();
  const { shop, addParty, enter, dispatch, send, refillerReturn, receive } = agency;
  const { unmatchedRow, asLines, partyReport } = agency;
  await enter(shop.id, [{ gas: "Argon", quantity: 50 }]);
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Lotus Clinic");
  const deccan = await addParty("refiller", "Deccan Gases");
  const zenith = await addParty("refiller", "Zenith Gases");
  await dispatch(hospital.id);
  // Two gases below zero, but one party.
  await receive(clinic.id, [], {
    unmatched: [unmatchedRow("Argon", 2), unmatchedRow("Nitrogen", 1)],
  });
  await send(deccan.id);
  await refillerReturn(zenith.id, { lines: asLines([{ gas: "Argon", quantity: 7 }]) });
  // Only its total is nothing.
  await send(zenith.id, { lines: asLines([{ gas: "Nitrogen", quantity: 7 }]) });

  expect((await partyReport()).summary).toEqual({
    active: { customer: 2, refiller: 2, supplier: 0 },
    withCustomers: 2,
    atRefillers: 5,
    belowZero: 2,
  });
});

test("the summary is of every party, however the list is narrowed", async () => {
  const { addParty, dispatch, send, partyReport } = await start();
  await dispatch((await addParty("customer", "City Hospital")).id);
  await send((await addParty("refiller", "Deccan Gases")).id);

  const narrowed = await partyReport("search=zzz&type=supplier");

  expect(narrowed.parties).toEqual([]);
  expect(narrowed.summary).toMatchObject({ withCustomers: 5, atRefillers: 5 });
});

test("an inactive party is not counted as active, and is listed when asked for", async () => {
  const { addParty, partyReport, deactivate } = await start();
  await deactivate(await addParty("customer", "City Hospital"));

  expect(await partyReport()).toMatchObject({ parties: [], summary: NONE });
  expect(await partyReport("inactive=true")).toMatchObject({
    parties: [{ name: "City Hospital", active: false }],
    summary: NONE,
  });
});

test("cylinders an inactive customer has come to hold are still counted", async () => {
  const { addParty, dispatch, receive, against, cancel, partyReport, deactivate } = await start();
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id);
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 5)]);
  await deactivate(customer);
  await cancel(returned);

  expect((await partyReport()).summary).toMatchObject({ withCustomers: 5 });
});

test("before any party is added, every figure is nothing", async () => {
  const { partyReport } = await start();

  expect(await partyReport()).toEqual({
    parties: [],
    summary: NONE,
    total: 0,
    page: 1,
    pageSize: 50,
  });
});

test("the list is narrowed and paged like the list of parties", async () => {
  const { addParty, partyReport } = await start();
  for (let count = 1; count <= 51; count += 1) {
    await addParty("customer", `Customer ${String(count).padStart(2, "0")}`);
  }
  await addParty("refiller", "Customer Gases");

  expect((await partyReport("type=refiller&search=cust")).parties).toMatchObject([
    { name: "Customer Gases" },
  ]);
  expect(await partyReport("type=customer&page=2")).toMatchObject({
    parties: [{ name: "Customer 51" }],
    total: 51,
    page: 2,
  });
});

test("the party list is read only when signed in", async () => {
  const { app } = await start();

  const response = await app.inject({ method: "GET", url: "/api/reports/parties" });

  expect(response.statusCode).toBe(401);
});
