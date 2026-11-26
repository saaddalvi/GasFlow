import { receivedReturnSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

/** The agency, with a customer who brings cylinders back. */
async function start(options?: { startDate: string | null }) {
  const agency = await startAgency(options);
  const customer = await agency.addParty("customer", "City Hospital");
  return { ...agency, customer };
}

test("staff receive empties against a dispatch bill, as one numbered return", async () => {
  const { staff, shop, customer, dispatch, receive, against, viewBill, bills, me } = await start();
  const sent = await dispatch(customer.id, { number: "1234", date: "2026-11-25" });

  const received = await receive(customer.id, [against(sent, "Medical oxygen", 3)]);

  expect(received).toEqual({
    id: expect.any(String) as string,
    number: "RET-20261126-001",
    customer: { id: customer.id, name: "City Hospital" },
    quantity: 3,
    unmatched: 0,
    bills: [{ id: sent.id, paperKind: "bill", number: "1234" }],
  });
  expect(await viewBill(received.id)).toMatchObject({
    type: "return_from_customer",
    number: "RET-20261126-001",
    paperKind: null,
    slipNumber: null,
    date: "2026-11-26",
    status: "posted",
    from: { id: customer.id, type: "customer" },
    to: { id: shop.id, type: "shop" },
    // Empty unless told otherwise.
    lines: [{ gas: { name: "Medical oxygen" }, fillState: "empty", quantity: 3 }],
    enteredBy: { id: (await me(staff.headers)).id, displayName: "Ravi Shah" },
    enteredAt: "2026-11-26T06:30:00.000Z",
  });
  expect(await bills()).toMatchObject({ total: 2 });
});

test("pending cylinders are listed oldest first, one row for each bill and gas", async () => {
  const { customer, enter, dispatch, asLines, gas, pending } = await start();
  const later = await dispatch(customer.id, {
    paperKind: "cash_memo",
    number: "88",
    date: "2026-11-20",
  });
  // Two lines of one gas make one row.
  const earlier = await dispatch(customer.id, {
    number: "1234",
    date: "2026-11-12",
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 4 },
      { gas: "Argon", quantity: 2 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  const opening = await enter(customer.id, [{ gas: "Nitrogen", quantity: 7 }]);
  const row = (bill: typeof opening, name: string, sent: number, daysOut: number) => ({
    bill: {
      id: bill.id,
      type: bill.type,
      paperKind: bill.paperKind,
      number: bill.number,
      date: bill.date,
    },
    gas: { id: gas(name).id, name },
    sent,
    returned: 0,
    writtenOff: 0,
    pending: sent,
    daysOut,
  });

  expect(await pending(customer.id)).toEqual([
    // Opening stock counts its days from the start date.
    row(opening, "Nitrogen", 7, 25),
    row(earlier, "Medical oxygen", 5, 14),
    row(earlier, "Argon", 2, 14),
    row(later, "Medical oxygen", 5, 6),
  ]);
});

test("a return lowers what is pending on the bill it is matched to, and no other", async () => {
  const { customer, dispatch, receive, against, asLines, pending } = await start();
  const first = await dispatch(customer.id, {
    date: "2026-11-12",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 2 },
      { gas: "Medical oxygen", quantity: 3 },
    ]),
  });
  await dispatch(customer.id, { date: "2026-11-20" });

  // More than either line of the first bill holds, then the rest of it but one.
  await receive(customer.id, [against(first, "Medical oxygen", 3)]);
  await receive(customer.id, [against(first, "Medical oxygen", 1)]);

  expect(await pending(customer.id)).toMatchObject([
    { bill: { id: first.id }, sent: 5, returned: 4, pending: 1 },
    { sent: 5, returned: 0, pending: 5 },
  ]);
});

test("one save makes one return across several bills and opening stock", async () => {
  const { customer, enter, dispatch, asLines, receive, against, viewBill, pending, bills } =
    await start();
  const first = await dispatch(customer.id, {
    paperKind: "cash_memo",
    number: "88",
    date: "2026-11-12",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 4 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  const second = await dispatch(customer.id, { number: "1234", date: "2026-11-20" });
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 3 }]);

  const received = await receive(customer.id, [
    against(second, "Medical oxygen", 1),
    against(first, "Argon", 2),
    against(first, "Medical oxygen", 4, { fillState: "defective" }),
    against(opening, "Medical oxygen", 2),
  ]);

  expect(received).toMatchObject({
    quantity: 9,
    // The oldest first, each named once.
    bills: [
      { id: opening.id, paperKind: null },
      { id: first.id, paperKind: "cash_memo", number: "88" },
      { id: second.id, paperKind: "bill", number: "1234" },
    ],
  });
  // One line for each gas and fill state, however many bills they came from.
  expect((await viewBill(received.id)).lines).toMatchObject([
    { gas: { name: "Medical oxygen" }, fillState: "empty", quantity: 3 },
    { gas: { name: "Argon" }, fillState: "empty", quantity: 2 },
    { gas: { name: "Medical oxygen" }, fillState: "defective", quantity: 4 },
  ]);
  expect(await pending(customer.id)).toMatchObject([
    { bill: { id: opening.id }, returned: 2, pending: 1 },
    { bill: { id: second.id }, returned: 1, pending: 4 },
  ]);
  expect(await bills()).toMatchObject({ total: 4 });
});

test("the customer's holding equals pending, and the shop gains what came back", async () => {
  const { shop, customer, enter, dispatch, receive, against, pending, figures } = await start();
  await enter(shop.id, [{ gas: "Medical oxygen", fillState: "filled", quantity: 40 }]);
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 4 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-10" });
  const held = async () => (await pending(customer.id)).reduce((sum, row) => sum + row.pending, 0);

  await receive(customer.id, [
    against(sent, "Medical oxygen", 2),
    against(sent, "Medical oxygen", 1, { fillState: "filled" }),
    against(opening, "Medical oxygen", 1, { fillState: "defective" }),
  ]);

  expect(await figures("Medical oxygen")).toMatchObject({
    shop: { filled: 36, empty: 2, defective: 1 },
    customers: 5,
    total: 44,
  });
  expect(await held()).toBe(5);

  // A bill entered late, dated in the past, adds to both.
  await dispatch(customer.id, { date: "2026-11-05" });

  expect(await figures("Medical oxygen")).toMatchObject({ customers: 10 });
  expect(await held()).toBe(10);
});

test("a return counts from its own date", async () => {
  const { customer, dispatch, receive, against, figures } = await start();
  const sent = await dispatch(customer.id, { date: "2026-11-10" });

  await receive(customer.id, [against(sent, "Medical oxygen", 3)], { date: "2026-11-15" });

  expect(await figures("Medical oxygen", "date=2026-11-14")).toMatchObject({ customers: 5 });
  expect(await figures("Medical oxygen", "date=2026-11-15")).toMatchObject({ customers: 2 });
});

test("returns are numbered by their date, in turn", async () => {
  const { customer, dispatch, receive, against } = await start();
  const sent = await dispatch(customer.id, { date: "2026-11-10" });
  const one = [against(sent, "Medical oxygen", 1)];

  expect(await receive(customer.id, one)).toMatchObject({ number: "RET-20261126-001" });
  expect(await receive(customer.id, one)).toMatchObject({ number: "RET-20261126-002" });
  expect(await receive(customer.id, one, { date: "2026-11-15" })).toMatchObject({
    number: "RET-20261115-001",
  });
});

test("a slip number is noted if given, and may be used again", async () => {
  const { customer, dispatch, receive, against, viewBill } = await start();
  const sent = await dispatch(customer.id);
  const one = [against(sent, "Medical oxygen", 1)];

  const first = await receive(customer.id, one, { slipNumber: " S-41 " });
  const second = await receive(customer.id, one, { slipNumber: "S-41" });
  const third = await receive(customer.id, one, { slipNumber: "  " });

  expect((await viewBill(first.id)).slipNumber).toBe("S-41");
  expect((await viewBill(second.id)).slipNumber).toBe("S-41");
  expect((await viewBill(third.id)).slipNumber).toBeNull();
});

test("admins receive empties too", async () => {
  const { admin, customer, dispatch, returnFor, postReturn, against, viewBill, me } = await start();
  const sent = await dispatch(customer.id);

  const response = await postReturn(
    returnFor(customer.id, [against(sent, "Medical oxygen", 1)], {
      // Who entered it, and what kind of bill it is, are not for the request to say.
      enteredById: "someone else",
      status: "cancelled",
      number: "9",
    }),
    admin,
  );

  expect(response.statusCode).toBe(201);
  expect(await viewBill(receivedReturnSchema.parse(response.json()).id)).toMatchObject({
    number: "RET-20261126-001",
    status: "posted",
    enteredBy: { id: (await me(admin.headers)).id },
  });
});

/** The agency, with 5 Medical oxygen out to the customer since 12 November. */
async function startWithDispatch() {
  const agency = await start();
  const sent = await agency.dispatch(agency.customer.id, { number: "1234", date: "2026-11-12" });
  return { ...agency, sent };
}

/** Asserts that the return was turned down and that nothing of it was saved. */
async function expectRefused(
  { postReturn, bills, figures }: Awaited<ReturnType<typeof start>>,
  payload: object,
  status: number,
  message: string,
) {
  const before = { bills: await bills(), figures: await figures("Medical oxygen") };

  const response = await postReturn(payload);

  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ message });
  expect({ bills: await bills(), figures: await figures("Medical oxygen") }).toEqual(before);
}

test("more than a bill has pending is refused, and no other row is saved", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, dispatch, receive, returnFor, against, pending } = agency;
  const other = await dispatch(customer.id, { date: "2026-11-13" });
  await receive(customer.id, [against(sent, "Medical oxygen", 3)]);

  await expectRefused(
    agency,
    returnFor(customer.id, [
      against(other, "Medical oxygen", 1),
      against(sent, "Medical oxygen", 3),
    ]),
    409,
    "Bill 1234 has only 2 Medical oxygen pending.",
  );
  expect(await pending(customer.id)).toMatchObject([{ pending: 2 }, { pending: 5 }]);
});

test("rows against the same cylinders are counted together", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor, against } = agency;

  await expectRefused(
    agency,
    returnFor(customer.id, [
      against(sent, "Medical oxygen", 3),
      against(sent, "Medical oxygen", 3, { fillState: "filled" }),
    ]),
    409,
    "Bill 1234 has only 5 Medical oxygen pending.",
  );
});

test("a row may be split between fill states, or sent twice", async () => {
  const { customer, sent, receive, against, viewBill, pending } = await startWithDispatch();

  const received = await receive(customer.id, [
    against(sent, "Medical oxygen", 2),
    against(sent, "Medical oxygen", 1),
    against(sent, "Medical oxygen", 2, { fillState: "filled" }),
  ]);

  expect((await viewBill(received.id)).lines).toMatchObject([
    { fillState: "empty", quantity: 3 },
    { fillState: "filled", quantity: 2 },
  ]);
  expect(await pending(customer.id)).toEqual([]);
});

test("nothing more can be returned against a bill with none pending", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, receive, returnFor, against } = agency;
  await receive(customer.id, [against(sent, "Medical oxygen", 5)]);

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 1)]),
    409,
    "Bill 1234 has no Medical oxygen pending.",
  );
});

test("only bills dated on or before the return date are offered", async () => {
  const { customer, sent, enter, dispatch, pending } = await startWithDispatch();
  await enter(customer.id, [{ gas: "Medical oxygen", quantity: 2 }]);
  const later = await dispatch(customer.id, { date: "2026-11-13" });
  const ids = async (date: string) => (await pending(customer.id, date)).map((row) => row.bill.id);

  expect(await ids("2026-11-12")).toEqual([expect.any(String) as string, sent.id]);
  expect(await ids("2026-11-13")).toEqual([expect.any(String) as string, sent.id, later.id]);
  // Opening stock is dated the start date.
  expect(await ids(START_DATE)).toHaveLength(1);
  expect(await ids("2026-10-31")).toEqual([]);
});

test("cylinders cannot come back before the bill they left on", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor, against } = agency;

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 1)], { date: "2026-11-11" }),
    409,
    "Bill 1234 is dated after the return.",
  );
});

test("a return may be dated the same day as the bill", async () => {
  const { customer, sent, receive, against } = await startWithDispatch();

  const received = await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
    date: "2026-11-12",
  });

  expect(received.number).toBe("RET-20261112-001");
});

test("pending counts every return, whatever its date", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, receive, returnFor, against, pending } = agency;
  await receive(customer.id, [against(sent, "Medical oxygen", 4)], { date: "2026-11-20" });

  // A return dated earlier cannot use what the later one has used.
  expect(await pending(customer.id, "2026-11-15")).toMatchObject([{ returned: 4, pending: 1 }]);
  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 2)], { date: "2026-11-15" }),
    409,
    "Bill 1234 has only 1 Medical oxygen pending.",
  );
});

test("a return dated before the start date is refused", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor, against } = agency;

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 1)], { date: "2026-10-31" }),
    409,
    "A bill cannot be dated before the start date.",
  );
});

test("a refusal names opening stock as such", async () => {
  const agency = await start();
  const { customer, enter, returnFor, against } = agency;
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 2 }]);

  await expectRefused(
    agency,
    returnFor(customer.id, [against(opening, "Medical oxygen", 3)]),
    409,
    "Opening stock has only 2 Medical oxygen pending.",
  );
});

test("a gas that is not on the bill cannot be returned against it", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor, against } = agency;

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Argon", 1)]),
    409,
    "Bill 1234 has no Argon on it.",
  );
});

test.each([
  ["another customer's dispatch bill", "dispatch to another customer"],
  ["another customer's opening stock", "opening stock of another customer"],
  ["a refiller's opening stock", "opening stock of a refiller"],
  ["a send to refiller", "send to refiller"],
  ["a return", "return"],
] as const)("a return cannot be matched to %s", async (_case, kind) => {
  const agency = await startWithDispatch();
  const { customer, sent, addParty, enter, dispatch, send, receive, returnFor, against } = agency;
  const clinic = await addParty("customer", "Apollo Clinic");
  const refiller = await addParty("refiller", "Zenith Gases");
  const oxygen = [{ gas: "Medical oxygen", quantity: 5 }];
  const others = {
    "dispatch to another customer": () => dispatch(clinic.id),
    "opening stock of another customer": () => enter(clinic.id, oxygen),
    "opening stock of a refiller": () => enter(refiller.id, oxygen),
    "send to refiller": () => send(refiller.id),
    return: () => receive(customer.id, [against(sent, "Medical oxygen", 1)]),
  };
  const other = await others[kind]();

  await expectRefused(
    agency,
    returnFor(customer.id, [against(other, "Medical oxygen", 1)]),
    409,
    `${other.number} is not a dispatch bill or opening stock of City Hospital.`,
  );
});

const NOTHING = "0b8f2c6e-1f4a-4d0b-9c55-999999999999";

test.each([
  ["customer", { customerId: NOTHING }, "There is no such party."],
  [
    "bill",
    { allocations: [{ billId: NOTHING, gasId: NOTHING, quantity: 1 }] },
    "There is no such bill.",
  ],
])("a return naming a %s that does not exist is refused", async (_case, change, message) => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor, against } = agency;

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 1)], change),
    404,
    message,
  );
});

test("a return naming a gas that does not exist is refused", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor } = agency;

  await expectRefused(
    agency,
    returnFor(customer.id, [{ billId: sent.id, gasId: NOTHING, quantity: 1 }]),
    404,
    "There is no such gas.",
  );
});

test("ids in capitals name the same things", async () => {
  const { customer, sent, receive, gas } = await startWithDispatch();

  const received = await receive(customer.id.toUpperCase(), [
    {
      billId: sent.id.toUpperCase(),
      gasId: gas("Medical oxygen").id.toUpperCase(),
      quantity: 2,
    },
  ]);

  expect(received).toMatchObject({ customer: { id: customer.id }, bills: [{ id: sent.id }] });
});

test.each(["refiller", "supplier"] as const)(
  "empties cannot be received from a %s",
  async (type) => {
    const agency = await startWithDispatch();
    const { sent, addParty, returnFor, against } = agency;
    const other = await addParty(type, "Zenith Gases");

    await expectRefused(
      agency,
      returnFor(other.id, [against(sent, "Medical oxygen", 1)]),
      409,
      "Zenith Gases is not a customer. Empties are received from a customer.",
    );
  },
);

test("empties cannot be received from an inactive customer", async () => {
  const agency = await startWithDispatch();
  const { app, staff, customer, sent, returnFor, against } = agency;
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { active: false },
  });

  await expectRefused(
    agency,
    returnFor(customer.id, [against(sent, "Medical oxygen", 1)]),
    409,
    "City Hospital is inactive. Make it active first.",
  );
});

test("cylinders of a gas retired since they went out can still come back", async () => {
  const { app, admin, customer, sent, gas, receive, against } = await startWithDispatch();
  await app.inject({
    method: "PATCH",
    url: `/api/gases/${gas("Medical oxygen").id}`,
    headers: admin.headers,
    payload: { active: false },
  });

  const received = await receive(customer.id, [against(sent, "Medical oxygen", 5)]);

  expect(received.quantity).toBe(5);
});

test("no empties can be received before the start date is set", async () => {
  const agency = await start({ startDate: null });

  await expectRefused(
    agency,
    agency.returnFor(agency.customer.id, [{ billId: NOTHING, gasId: NOTHING, quantity: 1 }]),
    409,
    "An admin has to set the start date before bills are entered.",
  );
});

const ROW = { billId: NOTHING, gasId: NOTHING, quantity: 1 };

test.each([
  ["no customer", { customerId: "" }, "Choose a customer."],
  ["no date", { date: "" }, "Choose the return date."],
  ["a date that does not exist", { date: "2026-11-31" }, "Choose the return date."],
  [
    "a long slip number",
    { slipNumber: "1".repeat(31) },
    "Use a slip number of at most 30 characters.",
  ],
  ["no rows", { allocations: [] }, "Enter how many cylinders came back on at least one row."],
  ["a row of none", { allocations: [{ ...ROW, quantity: 0 }] }, "Enter a quantity of 1 or more"],
  ["part of a cylinder", { allocations: [{ ...ROW, quantity: 1.5 }] }, "as a whole number"],
  ["a row with no bill", { allocations: [{ ...ROW, billId: "" }] }, "Choose a bill on each row."],
  [
    "an unknown fill state",
    { allocations: [{ ...ROW, fillState: "full" }] },
    "Choose filled, empty or defective.",
  ],
])("a return with %s is refused", async (_case, change, message) => {
  const agency = await startWithDispatch();

  const response = await agency.postReturn(agency.returnFor(agency.customer.id, [ROW], change));

  expect(response.statusCode).toBe(400);
  expect(response.json<{ message: string }>().message).toContain(message);
});

test("the new bill form's route does not take a customer return", async () => {
  const { customer, dispatchFor, postBill, bills } = await start();

  const response = await postBill(dispatchFor(customer.id, { type: "return_from_customer" }));

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Choose the type of bill." });
  expect(await bills()).toMatchObject({ total: 0 });
});

test("someone signed out cannot receive empties", async () => {
  const { app } = await start();

  const response = await app.inject({ method: "POST", url: "/api/returns", payload: {} });

  expect(response.statusCode).toBe(401);
});

test("saves at the same moment never over-return a bill", async () => {
  const agency = await startWithDispatch();
  const { customer, sent, returnFor, postReturn, against, openConnections, pending } = agency;
  // Of the 5 pending, two of these four returns fit.
  const payload = returnFor(customer.id, [against(sent, "Medical oxygen", 2)]);
  await openConnections();

  const responses = await Promise.all(Array.from({ length: 4 }, () => postReturn(payload)));

  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 201, 409, 409]);
  for (const response of responses.filter((response) => response.statusCode === 409)) {
    expect(response.json()).toMatchObject({
      message: "Bill 1234 has only 1 Medical oxygen pending.",
    });
  }
  expect(await pending(customer.id)).toMatchObject([{ returned: 4, pending: 1 }]);
  expect(await agency.bills()).toMatchObject({ total: 3 });
  expect(await agency.figures("Medical oxygen")).toMatchObject({ customers: 1 });
});

test("returns saved at the same moment each get their own number", async () => {
  const agency = await start();
  const { addParty, dispatch, returnFor, postReturn, against, openConnections } = agency;
  // A different customer each, so that nothing makes them take turns but the number.
  const payloads = [];
  for (const name of ["A", "B", "C", "D"]) {
    const { id } = await addParty("customer", name);
    payloads.push(returnFor(id, [against(await dispatch(id), "Medical oxygen", 1)]));
  }
  await openConnections();

  const responses = await Promise.all(payloads.map((payload) => postReturn(payload)));

  expect(
    responses.map((response) => receivedReturnSchema.parse(response.json()).number).sort(),
  ).toEqual(["RET-20261126-001", "RET-20261126-002", "RET-20261126-003", "RET-20261126-004"]);
});

test("rows with nothing pending are listed apart, the newest first", async () => {
  const { customer, dispatch, receive, against, asLines, gas, pending, closed } = await start();
  const first = await dispatch(customer.id, {
    number: "1234",
    date: "2026-11-12",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  const second = await dispatch(customer.id, { date: "2026-11-20" });
  await receive(customer.id, [
    against(first, "Argon", 2),
    against(second, "Medical oxygen", 5),
    against(first, "Medical oxygen", 1),
  ]);

  expect(await pending(customer.id)).toMatchObject([{ gas: { name: "Medical oxygen" } }]);
  expect(await closed(customer.id)).toMatchObject({
    rows: [
      { bill: { id: second.id }, sent: 5, returned: 5, pending: 0 },
      {
        bill: { id: first.id, number: "1234", date: "2026-11-12" },
        gas: { id: gas("Argon").id, name: "Argon" },
        sent: 2,
        returned: 2,
        pending: 0,
      },
    ],
    total: 2,
    page: 1,
  });
  // A bill dated after the return date is not shown here either.
  expect(await closed(customer.id, "", "2026-11-19")).toMatchObject({ total: 1 });
});

test("closed rows come a page at a time", async () => {
  const { customer, dispatch, receive, against, gas, closed } = await start();
  const lines = [{ gasId: gas("Medical oxygen").id, fillState: "filled", quantity: 1 }];
  const sent = [];
  for (let bill = 0; bill < 51; bill += 1) {
    sent.push(await dispatch(customer.id, { date: "2026-11-12", lines }));
  }
  await receive(
    customer.id,
    sent.map((bill) => against(bill, "Medical oxygen", 1)),
  );

  const [first, second] = [await closed(customer.id), await closed(customer.id, "page=2")];

  expect(first).toMatchObject({ total: 51, pageSize: 50 });
  expect(first.rows).toHaveLength(50);
  expect(second.rows).toHaveLength(1);
  expect(new Set([...first.rows, ...second.rows].map((row) => row.bill.id)).size).toBe(51);
});

test("the picker lists active customers with what each has pending", async () => {
  const agency = await start();
  const { app, staff, shop, customer, addParty, enter, dispatch, receive, against } = agency;
  const clinic = await addParty("customer", "Apollo Clinic");
  const gone = await addParty("customer", "Zed Labs");
  await addParty("refiller", "Zenith Gases");
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${gone.id}`,
    headers: staff.headers,
    payload: { active: false },
  });
  await enter(shop.id, [{ gas: "Argon", quantity: 9 }]);
  await enter(customer.id, [{ gas: "Argon", quantity: 3 }]);
  const sent = await dispatch(customer.id);
  await receive(customer.id, [against(sent, "Medical oxygen", 1)]);

  expect(await agency.returnCustomers()).toEqual({
    customers: [
      { id: clinic.id, name: "Apollo Clinic", mobile: null, pending: 0 },
      { id: customer.id, name: "City Hospital", mobile: null, pending: 7 },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  });
  expect(await agency.returnCustomers("search=hosp")).toMatchObject({
    customers: [{ id: customer.id }],
    total: 1,
  });
});

test.each([
  ["pending", "date=2026-11-26", 400, "Choose a customer."],
  ["pending", "customerId=NOBODY&date=2026-11-26", 400, "Choose a customer."],
  ["pending", `customerId=${NOTHING}&date=2026-11-26`, 404, "There is no such party."],
  ["pending", `customerId=${NOTHING}`, 400, "Choose the return date."],
  ["closed", `customerId=${NOTHING}&date=2026-11-26&page=0`, 400, "There is no such page."],
])("asking for %s rows with %s is refused", async (list, query, status, message) => {
  const { get } = await start();

  const response = await get(`/api/returns/${list}?${query}`);

  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ message });
});

test("a dispatch bill shows what was sent, returned and pending, and each return", async () => {
  const {
    admin,
    staff,
    customer,
    dispatch,
    receive,
    returnFor,
    postReturn,
    against,
    viewBill,
    me,
  } = await start();
  const sent = await dispatch(customer.id, { date: "2026-11-12" });
  expect(sent.returns).toMatchObject({
    sent: 5,
    returned: 0,
    pending: 5,
    status: "open",
    entries: [],
  });

  const later = await receive(customer.id, [against(sent, "Medical oxygen", 1)]);
  const earlier = await postReturn(
    returnFor(customer.id, [against(sent, "Medical oxygen", 2)], { date: "2026-11-15" }),
    admin,
  );

  const oxygen = { id: expect.any(String) as string, name: "Medical oxygen" };
  expect((await viewBill(sent.id)).returns).toEqual({
    sent: 5,
    returned: 3,
    writtenOff: 0,
    pending: 2,
    status: "partly_returned",
    gases: [{ gas: oxygen, sent: 5, returned: 3, writtenOff: 0, pending: 2 }],
    // By their dates, whenever they were entered.
    entries: [
      {
        id: receivedReturnSchema.parse(earlier.json()).id,
        type: "return_from_customer",
        number: "RET-20261115-001",
        date: "2026-11-15",
        quantity: 2,
        gases: [{ gas: oxygen, quantity: 2 }],
        enteredBy: { id: (await me(admin.headers)).id, displayName: "Asha Patil" },
      },
      {
        id: later.id,
        type: "return_from_customer",
        number: "RET-20261126-001",
        date: "2026-11-26",
        quantity: 1,
        gases: [{ gas: oxygen, quantity: 1 }],
        enteredBy: { id: (await me(staff.headers)).id, displayName: "Ravi Shah" },
      },
    ],
  });
});

test("a bill is closed once nothing is pending on any gas", async () => {
  const { customer, dispatch, asLines, receive, against, viewBill } = await start();
  const sent = await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 2 },
      { gas: "Argon", quantity: 1 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  const returns = async () => (await viewBill(sent.id)).returns;

  await receive(customer.id, [against(sent, "Medical oxygen", 3)]);

  expect(await returns()).toMatchObject({
    sent: 4,
    returned: 3,
    pending: 1,
    status: "partly_returned",
    gases: [
      { gas: { name: "Medical oxygen" }, sent: 3, returned: 3, pending: 0 },
      { gas: { name: "Argon" }, sent: 1, returned: 0, pending: 1 },
    ],
  });

  await receive(customer.id, [against(sent, "Argon", 1)]);

  expect(await returns()).toMatchObject({ returned: 4, pending: 0, status: "closed" });
});

test("a return covering several gases is listed once on the bill, with only its share", async () => {
  const { customer, dispatch, asLines, receive, against, viewBill } = await start();
  const sent = await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", quantity: 4 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  const other = await dispatch(customer.id);

  await receive(customer.id, [
    against(other, "Medical oxygen", 5),
    against(sent, "Argon", 2),
    against(sent, "Medical oxygen", 1),
    against(sent, "Medical oxygen", 1, { fillState: "filled" }),
  ]);

  expect((await viewBill(sent.id)).returns?.entries).toMatchObject([
    {
      quantity: 4,
      gases: [
        { gas: { name: "Medical oxygen" }, quantity: 2 },
        { gas: { name: "Argon" }, quantity: 2 },
      ],
    },
  ]);
});

test("a customer's opening stock shows its returns like a dispatch bill", async () => {
  const { customer, enter, receive, against, viewBill } = await start();
  const opening = await enter(customer.id, [{ gas: "Argon", quantity: 3 }]);

  await receive(customer.id, [against(opening, "Argon", 1)]);

  expect((await viewBill(opening.id)).returns).toMatchObject({
    sent: 3,
    returned: 1,
    pending: 2,
    status: "partly_returned",
    entries: [{ quantity: 1 }],
  });
});

test("only bills that cylinders are pending on show returns", async () => {
  const agency = await start();
  const { shop, customer, addParty, enter, send, refillerReturn, dispatch, receive } = agency;
  const refiller = await addParty("refiller", "Zenith Gases");
  const oxygen = [{ gas: "Medical oxygen", quantity: 5 }];
  const sent = await dispatch(customer.id);
  const received = await receive(customer.id, [agency.against(sent, "Medical oxygen", 1)]);
  const others = [
    await enter(shop.id, oxygen),
    await enter(refiller.id, oxygen),
    await send(refiller.id),
    await refillerReturn(refiller.id),
    await agency.viewBill(received.id),
  ];

  expect(others.map((bill) => bill.returns)).toEqual(others.map(() => null));
});
