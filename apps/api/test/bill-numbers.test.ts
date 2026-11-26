import { billNumberUseSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/**
 * The agency, with a customer, a refiller and ways to ask whether a number is
 * taken.
 */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");
  const refiller = await agency.addParty("refiller", "Zenith Gases");

  /** What the form is told while a number is typed. */
  async function use(paperKind: string, number: string) {
    const query = new URLSearchParams({ paperKind, number });
    const response = await agency.get(`/api/bills/number-use?${query.toString()}`);
    expect(response.statusCode).toBe(200);
    return billNumberUseSchema.parse(response.json()).usedBy;
  }

  /** What the form is told while a refiller's slip number is typed. */
  async function slipUse(refillerId: string, number: string) {
    const query = new URLSearchParams({ refillerId, number });
    const response = await agency.get(`/api/bills/refiller-slip-number-use?${query.toString()}`);
    expect(response.statusCode).toBe(200);
    return billNumberUseSchema.parse(response.json()).usedBy;
  }

  return { ...agency, customer, refiller, use, slipUse };
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

test.each([
  ["a dispatch", "a send to refiller", "dispatch", "send"],
  ["a send to refiller", "a dispatch", "send", "dispatch"],
] as const)(
  "the number of %s is taken for %s on the same paper kind",
  async (_first, _second, first, second) => {
    const { clock, customer, refiller, dispatchFor, sendFor, postBill, bills } = await start();
    const entries = {
      dispatch: (change: object) => dispatchFor(customer.id, change),
      send: (change: object) => sendFor(refiller.id, change),
    };
    await postBill(entries[first]({ paperKind: "cash_memo", number: "A-88" }));
    // In another year too.
    clock.set("2031-04-02T06:30:00.000Z");

    const response = await postBill(
      entries[second]({ paperKind: "cash_memo", number: " a-88 ", date: "2031-04-02" }),
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: "Cash memo number a-88 is already in use." });
    expect(await bills()).toMatchObject({ total: 1 });
  },
);

test("a send to refiller may have the number of a dispatch on the other paper kind", async () => {
  const { customer, refiller, dispatch, send } = await start();
  await dispatch(customer.id, { paperKind: "bill", number: "1234" });

  const memo = await send(refiller.id, { paperKind: "cash_memo", number: "1234" });

  expect(memo).toMatchObject({ paperKind: "cash_memo", number: "1234" });
});

test("of a dispatch and a send to refiller saved with one number at the same moment, one is kept", async () => {
  const { customer, refiller, dispatchFor, sendFor, postBill, openConnections, bills } =
    await start();
  const saves = [
    dispatchFor(customer.id, { number: "500" }),
    sendFor(refiller.id, { number: "500" }),
  ];
  await openConnections();

  const responses = await Promise.all(saves.map((save) => postBill(save)));

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
  expect(await bills()).toMatchObject({ total: 1 });
});

test("the form is told that a send to refiller uses a number", async () => {
  const { refiller, send, use } = await start();
  const bill = await send(refiller.id, { number: "1234", date: "2026-11-12" });

  expect(await use("bill", "1234")).toEqual({ id: bill.id, date: "2026-11-12" });
});

test("a refiller's slip number already used for that refiller is refused, in any year", async () => {
  const { clock, refiller, refillerReturn, refillerReturnFor, postBill, bills, figures } =
    await start();
  await refillerReturn(refiller.id, { number: "ZG-551" });
  clock.set("2031-04-02T06:30:00.000Z");

  const response = await postBill(
    refillerReturnFor(refiller.id, { number: " zg-551 ", date: "2031-04-02" }),
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "This refiller's slip number zg-551 is already in use.",
  });
  expect(await bills()).toMatchObject({ total: 1 });
  expect(await figures("Medical oxygen")).toMatchObject({ refillers: -5 });
});

test("two refillers may use the same slip number", async () => {
  const { refiller, addParty, refillerReturn } = await start();
  const other = await addParty("refiller", "Coastal Air");
  await refillerReturn(refiller.id, { number: "551" });

  const bill = await refillerReturn(other.id, { number: "551" });

  expect(bill).toMatchObject({ number: "551", from: { id: other.id } });
});

test("a slip number and a number on the agency's paper do not collide", async () => {
  const { customer, refiller, dispatch, send, refillerReturn } = await start();
  await dispatch(customer.id, { paperKind: "bill", number: "700" });
  await refillerReturn(refiller.id, { number: "700" });
  await refillerReturn(refiller.id, { number: "800" });

  const memo = await send(refiller.id, { paperKind: "cash_memo", number: "700" });
  const bill = await send(refiller.id, { paperKind: "bill", number: "800" });

  expect(memo.number).toBe("700");
  expect(bill.number).toBe("800");
});

test("a return from refiller keeps no paper kind, whatever the request says", async () => {
  const { customer, refiller, dispatch, refillerReturn } = await start();
  await dispatch(customer.id, { paperKind: "bill", number: "700" });

  const slip = await refillerReturn(refiller.id, { paperKind: "bill", number: "700" });

  expect(slip.paperKind).toBeNull();
});

test("of several returns from refiller saved with one slip number at once, one is kept", async () => {
  const { refiller, refillerReturnFor, postBill, openConnections, bills } = await start();
  const saves = Array.from({ length: 4 }, () => refillerReturnFor(refiller.id, { number: "500" }));
  await openConnections();

  const responses = await Promise.all(saves.map((save) => postBill(save)));

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409, 409]);
  expect(await bills()).toMatchObject({ total: 1 });
});

test("the form is told which return from refiller already uses the refiller's slip number", async () => {
  const { refiller, refillerReturn, slipUse } = await start();
  const bill = await refillerReturn(refiller.id, { number: "ZG-551", date: "2026-11-12" });

  expect(await slipUse(refiller.id, " zg-551 ")).toEqual({ id: bill.id, date: "2026-11-12" });
});

test("the form is told that a slip number is free for another refiller", async () => {
  const { refiller, addParty, refillerReturn, slipUse } = await start();
  const other = await addParty("refiller", "Coastal Air");
  await refillerReturn(refiller.id, { number: "551" });

  expect(await slipUse(other.id, "551")).toBeNull();
});

test("the form is told that a number only on the agency's paper is free as a slip number", async () => {
  const { refiller, send, slipUse } = await start();
  await send(refiller.id, { number: "551" });

  expect(await slipUse(refiller.id, "551")).toBeNull();
});

const SOME_REFILLER = "0b8f2c6e-1f4a-4d0b-9c55-999999999999";

test.each([
  [`refillerId=${SOME_REFILLER}`, "Enter the refiller's slip number."],
  ["number=1", "Choose a refiller."],
  ["refillerId=zenith&number=1", "Choose a refiller."],
])("asking about the slip number with %s is refused", async (query, message) => {
  const { get } = await start();

  const response = await get(`/api/bills/refiller-slip-number-use?${query}`);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});
