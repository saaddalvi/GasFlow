import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

/** The agency, with a customer who brings cylinders back. */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");
  return { ...agency, customer };
}

test("a total fills the oldest bills of the gas first, opening stock before any dispatch", async () => {
  const { customer, enter, dispatch, asLines, split } = await start();
  const later = await dispatch(customer.id, { date: "2026-11-20" });
  const earlier = await dispatch(customer.id, {
    date: "2026-11-12",
    lines: asLines([
      { gas: "Argon", quantity: 9 },
      { gas: "Medical oxygen", quantity: 4 },
    ]),
  });
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 3 }]);

  expect(await split(customer.id, "Medical oxygen", 9)).toEqual({
    rows: [
      { billId: opening.id, quantity: 3 },
      { billId: earlier.id, quantity: 4 },
      { billId: later.id, quantity: 2 },
    ],
    excess: 0,
  });
});

test("bills on the same date fill in the order they were entered, opening stock first", async () => {
  const { customer, clock, enter, dispatch, split } = await start();
  clock.set("2026-11-26T09:00:00.000Z");
  const enteredLast = await dispatch(customer.id, { number: "1", date: "2026-11-12" });
  clock.set("2026-11-26T08:00:00.000Z");
  const enteredFirst = await dispatch(customer.id, { number: "2", date: "2026-11-12" });
  // Dated the start date, like opening stock, and entered before it.
  const onStartDate = await dispatch(customer.id, { date: START_DATE });
  clock.set("2026-11-26T10:00:00.000Z");
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 2 }]);

  expect((await split(customer.id, "Medical oxygen", 14)).rows).toEqual(
    [
      [opening, 2],
      [onStartDate, 5],
      [enteredFirst, 5],
      [enteredLast, 2],
    ].map(([bill, quantity]) => ({ billId: (bill as { id: string }).id, quantity })),
  );
});

test("only bills dated on or before the return date are filled", async () => {
  const { customer, dispatch, receive, against, split } = await start();
  const first = await dispatch(customer.id, { date: "2026-11-12" });
  const second = await dispatch(customer.id, { date: "2026-11-20" });
  // A later return still uses up what it was matched to.
  await receive(customer.id, [against(first, "Medical oxygen", 3)], { date: "2026-11-25" });

  expect(await split(customer.id, "Medical oxygen", 4, "2026-11-19")).toMatchObject({
    rows: [{ billId: first.id, quantity: 2 }],
    excess: 2,
  });
  // On a later date, the next bill is filled too.
  expect(await split(customer.id, "Medical oxygen", 4, "2026-11-20")).toMatchObject({
    rows: [
      { billId: first.id, quantity: 2 },
      { billId: second.id, quantity: 2 },
    ],
    excess: 0,
  });
  expect(await split(customer.id, "Medical oxygen", 4, "2026-11-11")).toEqual({
    rows: [],
    excess: 4,
  });
});

test("a total larger than everything pending fills all of it and gives the excess", async () => {
  const { customer, dispatch, asLines, receive, against, split } = await start();
  const closed = await dispatch(customer.id, { date: "2026-11-10" });
  await receive(customer.id, [against(closed, "Medical oxygen", 5)]);
  const open = await dispatch(customer.id, {
    date: "2026-11-12",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 4 },
    ]),
  });
  await receive(customer.id, [against(open, "Medical oxygen", 1)]);

  // Another gas, and a bill with nothing left pending, take none of it.
  expect(await split(customer.id, "Medical oxygen", 10)).toMatchObject({
    rows: [{ billId: open.id, quantity: 4 }],
    excess: 6,
  });
  expect(await split(customer.id, "Argon", 4)).toMatchObject({
    rows: [{ billId: open.id, quantity: 4 }],
    excess: 0,
  });
});

test("a gas with nothing pending is all excess", async () => {
  const { customer, dispatch, split } = await start();
  await dispatch(customer.id);

  expect(await split(customer.id, "Nitrogen", 3)).toEqual({ rows: [], excess: 3 });
});

test("proposing a split saves nothing", async () => {
  const { customer, dispatch, split, pending, bills } = await start();
  await dispatch(customer.id);

  await split(customer.id, "Medical oxygen", 3);

  expect(await pending(customer.id)).toMatchObject([{ returned: 0, pending: 5 }]);
  expect(await bills()).toMatchObject({ total: 1 });
});

test.each([
  ["0", "Enter a total of 1 or more."],
  ["2.5", "Enter the total as a whole number of cylinders."],
  ["many", "Enter the total as a whole number of cylinders."],
])("a total of %s is refused", async (total, message) => {
  const { customer, gas, askSplit } = await start();

  const response = await askSplit(customer.id, gas("Medical oxygen").id, total);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});

test("a customer or gas that does not exist is refused", async () => {
  const { customer, gas, askSplit } = await start();
  const nobody = "00000000-0000-4000-8000-000000000000";

  const noCustomer = await askSplit(nobody, gas("Medical oxygen").id, 1);
  expect(noCustomer.statusCode).toBe(404);
  expect(noCustomer.json()).toMatchObject({ message: "There is no such party." });

  const noGas = await askSplit(customer.id, nobody, 1);
  expect(noGas.statusCode).toBe(404);
  expect(noGas.json()).toMatchObject({ message: "There is no such gas." });
  // The gas's id in capitals still names it.
  expect((await askSplit(customer.id, gas("Argon").id.toUpperCase(), 1)).statusCode).toBe(200);
});

test("someone signed out cannot ask for a split", async () => {
  const { customer, gas, askSplit } = await start();

  const response = await askSplit(customer.id, gas("Argon").id, 1, { as: { headers: {} } });

  expect(response.statusCode).toBe(401);
});
