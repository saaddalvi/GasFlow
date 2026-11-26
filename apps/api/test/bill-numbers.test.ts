import { billNumberUseSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/** The agency, with a customer and a way to ask whether a number is taken. */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");

  /** What the form is told while a number is typed. */
  async function use(paperKind: string, number: string) {
    const query = new URLSearchParams({ paperKind, number });
    const response = await agency.get(`/api/bills/number-use?${query.toString()}`);
    expect(response.statusCode).toBe(200);
    return billNumberUseSchema.parse(response.json()).usedBy;
  }

  return { ...agency, customer, use };
}

test("a number already on a bill of the same paper kind is refused", async () => {
  const { customer, dispatch, dispatchFor, postBill, bills } = await start();
  await dispatch(customer.id, { number: "1234" });

  const response = await postBill(dispatchFor(customer.id, { number: " 1234 " }));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "Bill number 1234 is already in use." });
  expect(await bills()).toMatchObject({ total: 1 });
});

test("a number is taken for every customer, in any year", async () => {
  const { clock, customer, addParty, dispatch, dispatchFor, postBill } = await start();
  const clinic = await addParty("customer", "Apollo Clinic");
  await dispatch(customer.id, { paperKind: "cash_memo", number: "88" });
  clock.set("2031-04-02T06:30:00.000Z");

  const response = await postBill(
    dispatchFor(clinic.id, { paperKind: "cash_memo", number: "88", date: "2031-04-02" }),
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "Cash memo number 88 is already in use." });
});

test("the same number is accepted under the other paper kind", async () => {
  const { customer, dispatch } = await start();
  await dispatch(customer.id, { paperKind: "bill", number: "1234" });

  const memo = await dispatch(customer.id, { paperKind: "cash_memo", number: "1234" });

  expect(memo).toMatchObject({ paperKind: "cash_memo", number: "1234" });
});

test("numbers that differ only in capitals are the same number", async () => {
  const { customer, dispatch, dispatchFor, postBill, use } = await start();
  const first = await dispatch(customer.id, { number: "A-17" });

  const response = await postBill(dispatchFor(customer.id, { number: "a-17" }));

  expect(response.statusCode).toBe(409);
  expect(await use("bill", "a-17")).toMatchObject({ id: first.id });
});

test("a number typed on the paper may look like one the app issues", async () => {
  const { shop, customer, enter, dispatch } = await start();
  const opening = await enter(shop.id, [{ gas: "Argon", quantity: 1 }]);

  const bill = await dispatch(customer.id, { number: opening.number });

  expect(bill.number).toBe(opening.number);
});

test("of several bills saved with one number at the same moment, one is kept", async () => {
  const { addParty, dispatchFor, postBill, openConnections, bills, figures } = await start();
  // A different customer each, so that nothing but the number makes them collide.
  const saves = [];
  for (const name of ["A", "B", "C", "D"]) {
    const { id } = await addParty("customer", name);
    saves.push(dispatchFor(id, { number: "500" }));
  }
  await openConnections();

  const responses = await Promise.all(saves.map((save) => postBill(save)));

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409, 409]);
  for (const response of responses.filter((response) => response.statusCode === 409)) {
    expect(response.json()).toMatchObject({ message: "Bill number 500 is already in use." });
  }
  expect(await bills()).toMatchObject({ total: 1 });
  expect(await figures("Medical oxygen")).toMatchObject({ customers: 5 });
});

test("the form is told which bill already uses a number", async () => {
  const { customer, dispatch, use } = await start();
  const bill = await dispatch(customer.id, { number: "1234", date: "2026-11-12" });

  expect(await use("bill", " 1234 ")).toEqual({ id: bill.id, date: "2026-11-12" });
});

test.each([
  ["a number no bill has", "bill", "1235"],
  ["part of a number", "bill", "123"],
  ["the other paper kind", "cash_memo", "1234"],
])("the form is told that %s is free", async (_case, paperKind, number) => {
  const { customer, dispatch, use } = await start();
  await dispatch(customer.id, { paperKind: "bill", number: "1234" });

  expect(await use(paperKind, number)).toBeNull();
});

test.each(["%", "_", "12__"])("%s is a number like any other", async (number) => {
  const { customer, dispatch, use } = await start();
  await dispatch(customer.id, { number: "1234" });

  expect(await use("bill", number)).toBeNull();
});

test.each([
  ["paperKind=bill", "Enter the bill number."],
  ["paperKind=bill&number=", "Enter the bill number."],
  ["number=1", "Choose bill or cash memo."],
])("asking about %s is refused", async (query, message) => {
  const { get } = await start();

  const response = await get(`/api/bills/number-use?${query}`);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});
