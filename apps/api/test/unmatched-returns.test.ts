import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/** The agency, with a customer who has 5 Medical oxygen out since 12 November. */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");
  const sent = await agency.dispatch(customer.id, { number: "1234", date: "2026-11-12" });
  return { ...agency, customer, sent };
}

test("cylinders beyond everything pending are saved as unmatched, on the same return", async () => {
  const { customer, sent, receive, against, unmatchedRow, viewBill, pending } = await start();

  const received = await receive(customer.id, [against(sent, "Medical oxygen", 5)], {
    unmatched: [
      unmatchedRow("Medical oxygen", 2),
      unmatchedRow("Argon", 1, { fillState: "filled" }),
    ],
  });

  expect(received).toMatchObject({ quantity: 8, unmatched: 3, bills: [{ id: sent.id }] });
  expect((await viewBill(received.id)).lines).toMatchObject([
    { gas: { name: "Medical oxygen" }, fillState: "empty", quantity: 7 },
    { gas: { name: "Argon" }, fillState: "filled", quantity: 1 },
  ]);
  expect(await pending(customer.id)).toEqual([]);
  expect((await viewBill(sent.id)).returns).toMatchObject({ returned: 5, pending: 0 });
});

/** Asserts that the return was turned down and that nothing of it was saved. */
async function expectRefused(
  { postReturn, bills, unmatchedList }: Awaited<ReturnType<typeof start>>,
  payload: object,
  status: number,
  message: string,
) {
  const before = { bills: await bills(), unmatched: await unmatchedList() };

  const response = await postReturn(payload);

  expect(response.json()).toMatchObject({ message });
  expect(response.statusCode).toBe(status);
  expect({ bills: await bills(), unmatched: await unmatchedList() }).toEqual(before);
}

test("none can be left unmatched while any of the gas is pending", async () => {
  const agency = await start();
  const { customer, sent, dispatch, returnFor, against, unmatchedRow } = agency;
  await dispatch(customer.id, { date: "2026-11-20" });

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 5)], {
      unmatched: [unmatchedRow("Medical oxygen", 1)],
    }),
    409,
    "City Hospital still has 5 Medical oxygen pending on this date. " +
      "Return those against their bills before leaving any unmatched.",
  );
  await expectRefused(
    agency,
    returnFor(customer.id, [], { unmatched: [unmatchedRow("Medical oxygen", 1)] }),
    409,
    "City Hospital still has 10 Medical oxygen pending on this date. " +
      "Return those against their bills before leaving any unmatched.",
  );
});

test("pending of another gas does not stop cylinders being left unmatched", async () => {
  const { customer, receive, unmatchedRow, pending } = await start();

  const received = await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 2)] });

  expect(received).toMatchObject({ quantity: 2, unmatched: 2, bills: [] });
  expect(await pending(customer.id)).toMatchObject([{ pending: 5 }]);
});

test("a bill dated after the return does not stop cylinders being left unmatched", async () => {
  const { customer, receive, unmatchedRow } = await start();

  // The day before the bill, and then its own day.
  const received = await receive(customer.id, [], {
    date: "2026-11-11",
    unmatched: [unmatchedRow("Medical oxygen", 2)],
  });

  expect(received.unmatched).toBe(2);
});

test("pending used up by a later return does not stop cylinders being left unmatched", async () => {
  const { customer, sent, receive, against, unmatchedRow } = await start();
  await receive(customer.id, [against(sent, "Medical oxygen", 5)], { date: "2026-11-25" });

  const received = await receive(customer.id, [], {
    date: "2026-11-20",
    unmatched: [unmatchedRow("Medical oxygen", 2)],
  });

  expect(received.unmatched).toBe(2);
});

test("a customer with nothing pending can have cylinders saved as unmatched", async () => {
  const { addParty, receive, unmatchedRow, viewBill } = await start();
  const clinic = await addParty("customer", "Apollo Clinic");

  const received = await receive(clinic.id, [], {
    unmatched: [unmatchedRow("Medical oxygen", 2), unmatchedRow("Medical oxygen", 1)],
  });

  expect(received).toEqual({
    id: expect.any(String) as string,
    number: "RET-20261126-001",
    customer: { id: clinic.id, name: "Apollo Clinic" },
    quantity: 3,
    unmatched: 3,
    bills: [],
  });
  expect((await viewBill(received.id)).lines).toMatchObject([{ fillState: "empty", quantity: 3 }]);
});

const NOTHING = "0b8f2c6e-1f4a-4d0b-9c55-999999999999";

test("a retired gas cannot be left unmatched", async () => {
  const agency = await start();
  const { app, admin, customer, gas, returnFor, unmatchedRow } = agency;
  await app.inject({
    method: "PATCH",
    url: `/api/gases/${gas("Argon").id}`,
    headers: admin.headers,
    payload: { active: false },
  });

  await expectRefused(
    agency,
    returnFor(customer.id, [], { unmatched: [unmatchedRow("Argon", 1)] }),
    409,
    "Argon is retired. Bring it back to use it.",
  );
});

test("an unmatched gas that does not exist is refused", async () => {
  const agency = await start();

  await expectRefused(
    agency,
    agency.returnFor(agency.customer.id, [], { unmatched: [{ gasId: NOTHING, quantity: 1 }] }),
    404,
    "There is no such gas.",
  );
});

test.each([
  ["no rows of either sort", {}, "Enter how many cylinders came back on at least one row."],
  ["a row of none", { gasId: NOTHING, quantity: 0 }, "Enter a quantity of 1 or more"],
  ["part of a cylinder", { gasId: NOTHING, quantity: 1.5 }, "as a whole number"],
  ["no gas", { gasId: "", quantity: 1 }, "Choose a gas on each unmatched row."],
  [
    "an unknown fill state",
    { gasId: NOTHING, quantity: 1, fillState: "full" },
    "Choose filled, empty or defective.",
  ],
])("an unmatched return with %s is refused", async (_case, row, message) => {
  const { customer, returnFor, postReturn } = await start();
  const unmatched = "gasId" in row ? [row] : [];

  const response = await postReturn(returnFor(customer.id, [], { unmatched }));

  expect(response.statusCode).toBe(400);
  expect(response.json<{ message: string }>().message).toContain(message);
});

test("unmatched cylinders are listed oldest first, one row for each return and gas", async () => {
  const { customer, sent, addParty, dispatch, gas, receive, against, unmatchedRow, unmatchedList } =
    await start();
  const clinic = await addParty("customer", "Apollo Clinic");
  const later = await receive(customer.id, [against(sent, "Medical oxygen", 5)], {
    unmatched: [
      unmatchedRow("Medical oxygen", 2),
      unmatchedRow("Argon", 1),
      unmatchedRow("Medical oxygen", 1, { fillState: "defective" }),
    ],
  });
  const earlier = await receive(clinic.id, [], {
    date: "2026-11-15",
    unmatched: [unmatchedRow("Nitrogen", 4)],
  });
  // A return with nothing unmatched is not listed.
  const another = await dispatch(customer.id, { date: "2026-11-02" });
  await receive(customer.id, [against(another, "Medical oxygen", 1)], { date: "2026-11-02" });

  const row = (
    received: typeof later,
    date: string,
    party: { id: string; name: string },
    name: string,
    quantity: number,
  ) => ({
    return: { id: received.id, number: received.number, date },
    customer: { id: party.id, name: party.name },
    gas: { id: gas(name).id, name },
    quantity,
  });
  expect(await unmatchedList()).toEqual({
    rows: [
      row(earlier, "2026-11-15", clinic, "Nitrogen", 4),
      row(later, "2026-11-26", customer, "Medical oxygen", 3),
      row(later, "2026-11-26", customer, "Argon", 1),
    ],
    total: 3,
    page: 1,
    pageSize: 50,
  });
});

test("unmatched returns come a page at a time", async () => {
  const { customer, receive, unmatchedRow, unmatchedList } = await start();
  for (let count = 0; count < 51; count += 1) {
    await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 1)] });
  }

  const [first, second] = [await unmatchedList(), await unmatchedList("page=2")];

  expect(first).toMatchObject({ total: 51, pageSize: 50 });
  expect(first.rows).toHaveLength(50);
  expect(second.rows).toHaveLength(1);
  expect(new Set([...first.rows, ...second.rows].map((row) => row.return.id)).size).toBe(51);
});

test("a page of unmatched returns that cannot exist is refused", async () => {
  const { get } = await start();

  const response = await get("/api/returns/unmatched?page=0");

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "There is no such page." });
});

test("unmatched cylinders count as back at the shop and lower the customer's holding", async () => {
  const agency = await start();
  const { shop, customer, sent, enter, dispatch, asLines, receive, against, unmatchedRow } = agency;
  const { pending, figures, unmatchedList } = agency;
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 40 }]);

  await receive(customer.id, [against(sent, "Medical oxygen", 5)], {
    unmatched: [unmatchedRow("Medical oxygen", 2, { fillState: "defective" })],
  });

  expect(await figures("Medical oxygen")).toMatchObject({
    shop: { filled: 35, empty: 5, defective: 2 },
    // Nothing pending and 2 unmatched.
    customers: -2,
    total: 40,
  });

  // The missing dispatch bill is entered late. Both stand until someone matches them.
  await dispatch(customer.id, {
    date: "2026-11-20",
    lines: asLines([{ gas: "Medical oxygen", quantity: 6 }]),
  });

  expect(await figures("Medical oxygen")).toMatchObject({ customers: 4, total: 40 });
  expect(await pending(customer.id)).toMatchObject([{ pending: 6 }]);
  expect(await unmatchedList()).toMatchObject({ rows: [{ quantity: 2 }] });
});

/**
 * The agency after the customer's 5 came back with 3 more than were pending, and
 * the missing dispatch bill for 4, dated 20 November, was then entered.
 */
async function startUnmatched() {
  const agency = await start();
  const { customer, sent, receive, against, unmatchedRow, dispatch, asLines } = agency;
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 5)], {
    unmatched: [unmatchedRow("Medical oxygen", 3)],
  });
  const missing = await dispatch(customer.id, {
    number: "1300",
    date: "2026-11-20",
    lines: asLines([{ gas: "Medical oxygen", quantity: 4 }]),
  });
  /** The customer's holding of Medical oxygen, pending and unmatched. */
  const counts = async () => ({
    holding: (await agency.figures("Medical oxygen"))?.customers,
    pending: (await agency.pending(customer.id)).reduce((sum, row) => sum + row.pending, 0),
    unmatched: (await agency.unmatchedList()).rows.reduce((sum, row) => sum + row.quantity, 0),
  });
  return { ...agency, returned, missing, counts };
}

test("unmatched cylinders can be matched to a bill, part at a time", async () => {
  const { returned, missing, against, match, counts, unmatchedList, viewBill } =
    await startUnmatched();
  // Holding is pending minus unmatched.
  expect(await counts()).toEqual({ holding: 1, pending: 4, unmatched: 3 });

  expect(await match(returned, against(missing, "Medical oxygen", 1))).toEqual({ unmatched: 2 });

  expect(await counts()).toEqual({ holding: 1, pending: 3, unmatched: 2 });

  // The rest, against the same bill again.
  expect(await match(returned, against(missing, "Medical oxygen", 2))).toEqual({ unmatched: 0 });

  expect(await counts()).toEqual({ holding: 1, pending: 1, unmatched: 0 });
  expect(await unmatchedList()).toMatchObject({ rows: [], total: 0 });
  expect((await viewBill(missing.id)).returns).toMatchObject({
    returned: 3,
    pending: 1,
    status: "partly_returned",
    entries: [{ id: returned.id, quantity: 3 }],
  });
  // The return itself is as it was saved.
  expect((await viewBill(returned.id)).lines).toMatchObject([{ quantity: 8 }]);
});

test("a match may take unmatched cylinders of several fill states across a bill's lines", async () => {
  const {
    customer,
    receive,
    unmatchedRow,
    dispatch,
    asLines,
    against,
    match,
    viewBill,
    unmatchedList,
  } = await start();
  const returned = await receive(customer.id, [], {
    date: "2026-11-11",
    unmatched: [
      unmatchedRow("Argon", 2),
      unmatchedRow("Argon", 3, { fillState: "filled" }),
      unmatchedRow("Nitrogen", 1),
    ],
  });
  const missing = await dispatch(customer.id, {
    date: "2026-11-11",
    lines: asLines([
      { gas: "Argon", fillState: "filled", quantity: 1 },
      { gas: "Argon", fillState: "empty", quantity: 6 },
    ]),
  });

  expect(await match(returned, against(missing, "Argon", 4))).toEqual({ unmatched: 1 });

  expect(await unmatchedList()).toMatchObject({
    rows: [
      { gas: { name: "Argon" }, quantity: 1 },
      { gas: { name: "Nitrogen" }, quantity: 1 },
    ],
  });
  expect((await viewBill(missing.id)).returns).toMatchObject({ returned: 4, pending: 3 });
});

test("unmatched cylinders can be matched to opening stock, by an admin too", async () => {
  const { admin, addParty, receive, unmatchedRow, enter, against, postMatch, viewBill } =
    await start();
  const clinic = await addParty("customer", "Apollo Clinic");
  const returned = await receive(clinic.id, [], { unmatched: [unmatchedRow("Argon", 2)] });
  const opening = await enter(clinic.id, [{ gas: "Argon", quantity: 5 }]);

  const response = await postMatch(returned, against(opening, "Argon", 2), admin);

  expect(response.statusCode).toBe(201);
  expect((await viewBill(opening.id)).returns).toMatchObject({ returned: 2, pending: 3 });
});

/** Asserts that the match was turned down and that nothing of it was saved. */
async function expectMatchRefused(
  { postMatch, unmatchedList, pending, customer }: Awaited<ReturnType<typeof startUnmatched>>,
  [returned, row]: [{ id: string }, object],
  status: number,
  message: string,
) {
  const state = async () => ({
    unmatched: await unmatchedList(),
    pending: await pending(customer.id),
  });
  const before = await state();

  const response = await postMatch(returned, row);

  expect(response.json()).toMatchObject({ message });
  expect(response.statusCode).toBe(status);
  expect(await state()).toEqual(before);
}

test("no more can be matched than the return has unmatched", async () => {
  const agency = await startUnmatched();
  const { returned, missing, against } = agency;

  await expectMatchRefused(
    agency,
    [returned, against(missing, "Medical oxygen", 4)],
    409,
    `${returned.number} has only 3 Medical oxygen unmatched.`,
  );
});

test("nothing can be matched once none of the gas is unmatched", async () => {
  const agency = await startUnmatched();
  const { returned, missing, against, match } = agency;
  await match(returned, against(missing, "Medical oxygen", 3));

  await expectMatchRefused(
    agency,
    [returned, against(missing, "Medical oxygen", 1)],
    409,
    `${returned.number} has no Medical oxygen unmatched.`,
  );
});

test("no more can be matched than the bill has pending", async () => {
  const agency = await startUnmatched();
  const { returned, missing, receive, against, customer } = agency;
  await receive(customer.id, [against(missing, "Medical oxygen", 3)]);

  await expectMatchRefused(
    agency,
    [returned, against(missing, "Medical oxygen", 2)],
    409,
    "Bill 1300 has only 1 Medical oxygen pending.",
  );
});

test("unmatched cylinders cannot be matched to a bill dated after the return", async () => {
  const agency = await startUnmatched();
  const { customer, receive, unmatchedRow, against } = agency;
  const earlier = await receive(customer.id, [], {
    date: "2026-11-11",
    unmatched: [unmatchedRow("Medical oxygen", 1)],
  });

  await expectMatchRefused(
    agency,
    [earlier, against(agency.missing, "Medical oxygen", 1)],
    409,
    "Bill 1300 is dated after the return.",
  );
});

test("unmatched cylinders cannot be matched to another customer's bill", async () => {
  const agency = await startUnmatched();
  const { returned, addParty, dispatch, against } = agency;
  const clinic = await addParty("customer", "Apollo Clinic");
  const other = await dispatch(clinic.id, { number: "1400" });

  await expectMatchRefused(
    agency,
    [returned, against(other, "Medical oxygen", 1)],
    409,
    "1400 is not a dispatch bill or opening stock of City Hospital.",
  );
});

test("unmatched cylinders can only be matched to their own gas", async () => {
  const agency = await startUnmatched();
  const { returned, customer, dispatch, asLines, against } = agency;
  const argon = await dispatch(customer.id, {
    number: "1500",
    lines: asLines([{ gas: "Argon", quantity: 2 }]),
  });

  await expectMatchRefused(
    agency,
    [returned, against(argon, "Medical oxygen", 1)],
    409,
    "Bill 1500 has no Medical oxygen on it.",
  );
  await expectMatchRefused(
    agency,
    [returned, against(argon, "Argon", 1)],
    409,
    `${returned.number} has no Argon unmatched.`,
  );
});

test.each([
  ["a return that does not exist", () => ({ id: NOTHING })],
  ["something that is not an id", () => ({ id: "nothing" })],
  ["a dispatch bill", (agency: Awaited<ReturnType<typeof startUnmatched>>) => agency.sent],
])("matching from %s is refused", async (_case, from) => {
  const agency = await startUnmatched();

  await expectMatchRefused(
    agency,
    [from(agency), agency.against(agency.missing, "Medical oxygen", 1)],
    404,
    "There is no such return.",
  );
});

test("a match naming a bill that does not exist is refused", async () => {
  const agency = await startUnmatched();

  await expectMatchRefused(
    agency,
    [agency.returned, agency.against({ id: NOTHING }, "Medical oxygen", 1)],
    404,
    "There is no such bill.",
  );
});

test.each([
  ["no bill", { billId: "" }, "Choose a bill to match to."],
  ["no gas", { gasId: "" }, "Choose a gas to match."],
  ["a quantity of none", { quantity: 0 }, "Enter a quantity of 1 or more"],
])("a match with %s is refused", async (_case, change, message) => {
  const { returned, postMatch } = await startUnmatched();

  const response = await postMatch(returned, {
    billId: NOTHING,
    gasId: NOTHING,
    quantity: 1,
    ...change,
  });

  expect(response.statusCode).toBe(400);
  expect(response.json<{ message: string }>().message).toContain(message);
});

test("someone signed out cannot match unmatched cylinders", async () => {
  const { app } = await start();

  const response = await app.inject({
    method: "POST",
    url: `/api/returns/${NOTHING}/matches`,
    payload: {},
  });

  expect(response.statusCode).toBe(401);
});

test("matches sent at the same moment never exceed what is unmatched", async () => {
  const agency = await startUnmatched();
  const { returned, missing, against, postMatch, openConnections, counts } = agency;
  // Of the 3 unmatched, one of these four matches of 2 fits. The bill has 4 pending.
  const row = against(missing, "Medical oxygen", 2);
  await openConnections();

  const responses = await Promise.all(Array.from({ length: 4 }, () => postMatch(returned, row)));

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409, 409]);
  expect(await counts()).toEqual({ holding: 1, pending: 2, unmatched: 1 });
});

test("matches sent at the same moment never exceed what a bill has pending", async () => {
  const {
    customer,
    receive,
    unmatchedRow,
    dispatch,
    against,
    postMatch,
    openConnections,
    pending,
  } = await start();
  const returns = [];
  for (let count = 0; count < 4; count += 1) {
    returns.push(
      await receive(customer.id, [], { date: "2026-11-11", unmatched: [unmatchedRow("Argon", 2)] }),
    );
  }
  // 5 pending, so two matches of 2 fit.
  const missing = await dispatch(customer.id, {
    date: "2026-11-11",
    lines: [{ ...unmatchedRow("Argon", 5), fillState: "filled" }],
  });
  await openConnections();

  const responses = await Promise.all(
    returns.map((returned) => postMatch(returned, against(missing, "Argon", 2))),
  );

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 201, 409, 409]);
  expect(await pending(customer.id, "2026-11-11")).toMatchObject([{ returned: 4, pending: 1 }]);
});

test("a match and a return sent at the same moment cannot both use the same cylinders", async () => {
  const agency = await startUnmatched();
  const { customer, returned, missing, returnFor, against, openConnections, counts } = agency;
  // The bill has 4 pending, and each of these asks for 3 of them.
  const row = against(missing, "Medical oxygen", 3);
  await openConnections();

  const responses = await Promise.all([
    agency.postMatch(returned, row),
    agency.postReturn(returnFor(customer.id, [row])),
  ]);

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
  expect(await counts()).toMatchObject({ pending: 1 });
});
