import { billSchema, refusalSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/** The agency, with a customer who has 5 Medical oxygen pending on one dispatch bill. */
async function start() {
  const agency = await startAgency();
  const { shop, asLines, enter, addParty, dispatch } = agency;
  await enter(shop.id, [{ gas: "Medical oxygen", fillState: "filled", quantity: 20 }]);
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id, {
    number: "1234",
    date: "2026-11-10",
    lines: asLines([{ gas: "Medical oxygen", quantity: 5 }]),
  });
  return { ...agency, customer, sent };
}

test("an admin writes off a customer's lost cylinders against a dispatch bill", async () => {
  const agency = await start();
  const { admin, customer, sent, customerWriteOffFor, postCustomerWriteOff } = agency;

  const response = await postCustomerWriteOff(
    customerWriteOffFor(customer.id, sent, "Medical oxygen", 2, {
      notes: "  Not found at the ward.  ",
    }),
    admin,
  );

  expect(response.statusCode).toBe(201);
  const writtenOff = billSchema.parse(response.json());
  expect(writtenOff).toMatchObject({
    type: "write_off",
    number: "WOF-20261126-001",
    paperKind: null,
    date: "2026-11-26",
    status: "posted",
    from: { id: customer.id, type: "customer" },
    to: null,
    vehicle: null,
    writeOffReason: "lost",
    notes: "Not found at the ward.",
    lines: [{ gas: { name: "Medical oxygen" }, quantity: 2 }],
    enteredBy: { displayName: "Asha Patil" },
    returns: null,
  });
  expect(await agency.viewBill(writtenOff.id)).toEqual(writtenOff);
});

test("pending, the customer's holding and the total fall, and the shop is unchanged", async () => {
  const { customer, sent, customerWriteOff, pending, figures, returnCustomers } = await start();

  await customerWriteOff(customer.id, sent, "Medical oxygen", 2);

  expect(await pending(customer.id)).toMatchObject([
    { bill: { id: sent.id }, sent: 5, returned: 0, writtenOff: 2, pending: 3 },
  ]);
  expect((await returnCustomers()).customers).toMatchObject([{ pending: 3 }]);
  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 15, empty: 0, defective: 0 },
    customers: 3,
    refillers: 0,
    total: 18,
  });
});

test("a write-off can clear a whole bill, across its lines of one gas, and no more", async () => {
  const agency = await start();
  const { customer, dispatch, asLines, customerWriteOff, postCustomerWriteOff, pending } = agency;
  const twoLines = await dispatch(customer.id, {
    number: "77",
    lines: asLines([
      { gas: "Argon", fillState: "filled", quantity: 2 },
      { gas: "Argon", fillState: "empty", quantity: 1 },
    ]),
  });

  await customerWriteOff(customer.id, twoLines, "Argon", 3);

  expect(await pending(customer.id)).toMatchObject([{ bill: { number: "1234" }, pending: 5 }]);
  const response = await postCustomerWriteOff(
    agency.customerWriteOffFor(customer.id, twoLines, "Argon", 1),
  );
  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "Bill 77 has no Argon pending." });
});

test("no more can be written off than a bill has pending, whatever the date of what used it up", async () => {
  const agency = await start();
  const { customer, sent, receive, against, postCustomerWriteOff, pending, figures } = agency;
  // Dated after the write-off, and counted all the same.
  await receive(customer.id, [against(sent, "Medical oxygen", 3)]);

  const response = await postCustomerWriteOff(
    agency.customerWriteOffFor(customer.id, sent, "Medical oxygen", 3, { date: "2026-11-12" }),
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Bill 1234 has only 2 Medical oxygen pending.",
  });
  expect(await pending(customer.id)).toMatchObject([{ writtenOff: 0, pending: 2 }]);
  expect(await figures("Medical oxygen")).toMatchObject({ customers: 2, total: 20 });
});

test("a write-off is dated no earlier than its bill, and may be dated the same day", async () => {
  const { customer, sent, customerWriteOff, postCustomerWriteOff, customerWriteOffFor } =
    await start();

  const response = await postCustomerWriteOff(
    customerWriteOffFor(customer.id, sent, "Medical oxygen", 1, { date: "2026-11-09" }),
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "Bill 1234 is dated after the write-off." });
  const sameDay = await customerWriteOff(customer.id, sent, "Medical oxygen", 1, {
    date: "2026-11-10",
  });
  expect(sameDay.number).toBe("WOF-20261110-001");
});

test("a customer's opening stock takes write-offs", async () => {
  const { customer, enter, customerWriteOff, postCustomerWriteOff, customerWriteOffFor, pending } =
    await start();
  const opening = await enter(customer.id, [{ gas: "Argon", quantity: 4 }]);

  await customerWriteOff(customer.id, opening, "Argon", 1, { date: "2026-11-01" });

  expect(await pending(customer.id)).toMatchObject([
    { bill: { type: "opening_stock" }, writtenOff: 1, pending: 3 },
    { bill: { number: "1234" }, writtenOff: 0, pending: 5 },
  ]);
  const response = await postCustomerWriteOff(
    customerWriteOffFor(customer.id, opening, "Argon", 4),
  );
  expect(response.json()).toMatchObject({ message: "Opening stock has only 3 Argon pending." });
});

test.each([
  ["no customer", { customerId: undefined }, "Choose a customer."],
  // Naming no bill would leave it unmatched, which no write-off is.
  ["no bill", { billId: undefined }, "Choose the pending cylinders to write off."],
  ["no gas", { gasId: undefined }, "Choose the pending cylinders to write off."],
  ["no quantity", { quantity: undefined }, "Enter each quantity as a whole number."],
  ["nothing to write off", { quantity: 0 }, "Enter a quantity of 1 or more on each line."],
  ["no date", { date: undefined }, "Choose the bill date."],
  ["no reason", { writeOffReason: undefined }, "Choose scrapped or lost."],
])("a customer write-off with %s is refused", async (_case, change, message) => {
  const { customer, sent, customerWriteOffFor, postCustomerWriteOff, bills } = await start();

  const response = await postCustomerWriteOff(
    customerWriteOffFor(customer.id, sent, "Medical oxygen", 1, change),
  );

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  // The opening stock and the dispatch.
  expect(await bills()).toMatchObject({ total: 2 });
});

test("a write-off is only against the customer's own bills, for gases on them", async () => {
  const agency = await start();
  const { customer, sent, addParty, dispatch, cancel } = agency;
  const { customerWriteOffFor, postCustomerWriteOff } = agency;
  const other = await addParty("customer", "Lotus Clinic");
  const theirs = await dispatch(other.id, { number: "88" });
  const cancelled = await dispatch(customer.id, { number: "99" });
  await cancel(cancelled);
  const refused = async (payload: object) => {
    const response = await postCustomerWriteOff(payload);
    expect(response.statusCode).toBe(409);
    return refusalSchema.parse(response.json()).message;
  };

  expect(await refused(customerWriteOffFor(customer.id, theirs, "Medical oxygen", 1))).toBe(
    "88 is not a dispatch bill or opening stock of City Hospital.",
  );
  expect(await refused(customerWriteOffFor(customer.id, cancelled, "Medical oxygen", 1))).toBe(
    "Bill 99 has been cancelled.",
  );
  expect(await refused(customerWriteOffFor(customer.id, sent, "Argon", 1))).toBe(
    "Bill 1234 has no Argon on it.",
  );
});

test("only a customer's cylinders are written off against a bill", async () => {
  const { shop, sent, addParty, customerWriteOffFor, postCustomerWriteOff } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");

  for (const party of [refiller, shop]) {
    const response = await postCustomerWriteOff(
      customerWriteOffFor(party.id, sent, "Medical oxygen", 1),
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: `${party.name} is not a customer. Only a customer's cylinders are written off against a bill.`,
    });
  }
});

test("no customer write-off is dated before the start date", async () => {
  const { customer, sent, customerWriteOffFor, postCustomerWriteOff } = await start();

  const response = await postCustomerWriteOff(
    customerWriteOffFor(customer.id, sent, "Medical oxygen", 1, { date: "2026-10-31" }),
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "A bill cannot be dated before the start date.",
  });
});

test("staff who are not admins cannot write off a customer's cylinders", async () => {
  const { staff, customer, sent, customerWriteOffFor, postCustomerWriteOff, pending } =
    await start();

  const response = await postCustomerWriteOff(
    customerWriteOffFor(customer.id, sent, "Medical oxygen", 1),
    staff,
  );

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can write off cylinders." });
  expect(await pending(customer.id)).toMatchObject([{ pending: 5 }]);
});

test("someone signed out cannot write off a customer's cylinders", async () => {
  const { app } = await start();

  const response = await app.inject({
    method: "POST",
    url: "/api/customer-write-offs",
    payload: {},
  });

  expect(response.statusCode).toBe(401);
});

test("the bill shows what has been written off against it, and who did it", async () => {
  const agency = await start();
  const { admin, customer, sent, receive, against, customerWriteOff, viewBill, me } = agency;
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 2, {
    date: "2026-11-20",
  });
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
    date: "2026-11-15",
  });

  const { returns } = await viewBill(sent.id);

  const counts = { sent: 5, returned: 1, writtenOff: 2, pending: 2 };
  expect(returns).toEqual({
    ...counts,
    status: "partly_returned",
    gases: [{ gas: { id: expect.any(String) as string, name: "Medical oxygen" }, ...counts }],
    // The returns and the write-offs together, the oldest first.
    entries: [
      expect.objectContaining({ id: returned.id, type: "return_from_customer", quantity: 1 }),
      {
        id: writtenOff.id,
        type: "write_off",
        number: "WOF-20261120-001",
        date: "2026-11-20",
        quantity: 2,
        gases: [{ gas: { id: expect.any(String) as string, name: "Medical oxygen" }, quantity: 2 }],
        enteredBy: { id: (await me(admin.headers)).id, displayName: "Asha Patil" },
      },
    ],
  });
});

test("a bill's tag counts write-offs as clearing it", async () => {
  const { customer, sent, customerWriteOff, viewBill, closed, pending } = await start();
  const tag = async () => (await viewBill(sent.id)).returns?.status;
  expect(await tag()).toBe("open");

  await customerWriteOff(customer.id, sent, "Medical oxygen", 2);

  expect(await tag()).toBe("partly_returned");
  await customerWriteOff(customer.id, sent, "Medical oxygen", 3);
  expect(await tag()).toBe("closed");
  expect(await pending(customer.id)).toEqual([]);
  expect((await closed(customer.id)).rows).toMatchObject([
    { bill: { id: sent.id }, returned: 0, writtenOff: 5, pending: 0 },
  ]);
});

test("what is written off is no longer there to be returned or matched", async () => {
  const agency = await start();
  const { customer, sent, customerWriteOff, returnFor, postReturn, against, split, receive } =
    agency;
  await customerWriteOff(customer.id, sent, "Medical oxygen", 4);

  const response = await postReturn(returnFor(customer.id, [against(sent, "Medical oxygen", 2)]));

  expect(response.json()).toMatchObject({
    message: "Bill 1234 has only 1 Medical oxygen pending.",
  });
  expect(await split(customer.id, "Medical oxygen", 3)).toEqual({
    rows: [{ billId: sent.id, quantity: 1 }],
    excess: 2,
  });
  // Once the last is back, the rest of a return can be left unmatched.
  await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
    unmatched: [agency.unmatchedRow("Medical oxygen", 2)],
  });
});

test("a customer write-off cannot be corrected, even by an admin", async () => {
  const agency = await start();
  const { admin, customer, sent, customerWriteOff, postCorrection, viewBill, pending } = agency;
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 2);
  const message = "A write-off from a customer cannot be corrected. Cancel it and enter it again.";

  // As the correction form would send it, had it taken the write-off for the shop's.
  const asAdmin = await postCorrection(writtenOff, agency.correctionFor(writtenOff), admin);
  expect(asAdmin.statusCode).toBe(409);
  expect(asAdmin.json()).toMatchObject({ message });
  // Staff are told first that write-offs are for an admin to correct.
  const asStaff = await postCorrection(writtenOff, agency.correctionFor(writtenOff), agency.staff);
  expect(asStaff.statusCode).toBe(403);
  expect(asStaff.json()).toMatchObject({ message: "Only an admin can correct a write-off." });
  // Nor can it be made some other type of bill, or one from a refiller.
  const response = await postCorrection(writtenOff, agency.addCylindersFor(), admin);
  expect(response.json()).toMatchObject({ message });
  expect(await viewBill(writtenOff.id)).toEqual(writtenOff);
  expect(await pending(customer.id)).toMatchObject([{ writtenOff: 2, pending: 3 }]);
});

test("a write-off from the shop cannot be corrected into one from a customer", async () => {
  const { admin, customer, writeOffFor, postBill, postCorrection, correctionFor } = await start();
  const writtenOff = billSchema.parse((await postBill(writeOffFor(), admin)).json());

  const response = await postCorrection(
    writtenOff,
    correctionFor(writtenOff, { refillerId: customer.id }),
    admin,
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "City Hospital is not a refiller. A write-off is from the shop or a refiller.",
  });
});

test("cancelling a customer write-off restores what was pending", async () => {
  const agency = await start();
  const { customer, sent, customerWriteOff, cancel, pending, viewBill, figures } = agency;
  const before = await figures("Medical oxygen");
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 5);

  const cancelled = await cancel(writtenOff);

  expect(cancelled).toMatchObject({ status: "cancelled", writeOffReason: "lost" });
  expect(await pending(customer.id)).toMatchObject([{ writtenOff: 0, pending: 5 }]);
  expect((await viewBill(sent.id)).returns).toMatchObject({
    writtenOff: 0,
    pending: 5,
    status: "open",
    entries: [],
  });
  expect(await figures("Medical oxygen")).toEqual(before);
  // So it can be entered again, as it should have been.
  await customerWriteOff(customer.id, sent, "Medical oxygen", 1);
  expect(await pending(customer.id)).toMatchObject([{ writtenOff: 1, pending: 4 }]);
});

test("staff who are not admins cannot cancel a customer write-off", async () => {
  const { staff, customer, sent, customerWriteOff, postCancel, pending } = await start();
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 2);

  const response = await postCancel(writtenOff, undefined, staff);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can cancel a write-off." });
  expect(await pending(customer.id)).toMatchObject([{ pending: 3 }]);
});

test.each([
  ["write-offs", false, "Bill 1234 has write-offs matched to it. Cancel those first."],
  [
    "returns and write-offs",
    true,
    "Bill 1234 has returns and write-offs matched to it. Cancel those first.",
  ],
])(
  "a dispatch bill with %s cannot be cancelled until they are",
  async (_case, withReturn, message) => {
    const agency = await start();
    const { admin, customer, sent, customerWriteOff, receive, against, postCancel, cancel } =
      agency;
    const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 1);
    const returned = withReturn
      ? [
          await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
            date: "2026-11-15",
          }),
        ]
      : [];

    const response = await postCancel(sent, undefined, admin);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message,
      // The oldest first.
      blockingBills: [...returned, writtenOff].map(({ id, number }) => ({ id, number })),
    });
    for (const bill of [...returned, writtenOff]) {
      await cancel(bill);
    }
    expect((await postCancel(sent, undefined, admin)).statusCode).toBe(200);
  },
);

test.each([
  [
    "its customer changed",
    { customerId: "other" },
    "Bill 1234 has write-offs matched to it, so its customer cannot be changed. Cancel those write-offs first.",
  ],
  [
    "the gas removed",
    { gas: "Argon", quantity: 5 },
    "Bill 1234 cannot have fewer than the 2 Medical oxygen written off against it. Cancel the write-offs in the way first, or change the correction.",
  ],
  [
    "the gas lowered below it",
    { gas: "Medical oxygen", quantity: 1 },
    "Bill 1234 cannot have fewer than the 2 Medical oxygen written off against it. Cancel the write-offs in the way first, or change the correction.",
  ],
  [
    "its date moved after it",
    { date: "2026-11-21" },
    "Bill 1234 cannot be dated after cylinders were written off against it. Cancel the write-offs in the way first, or change the correction.",
  ],
])("a bill with a write-off cannot have %s", async (_case, change, message) => {
  const agency = await start();
  const { admin, customer, sent, customerWriteOff, addParty, asLines, correctionFor } = agency;
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 2, {
    date: "2026-11-20",
  });
  const other = await addParty("customer", "Lotus Clinic");
  const corrected =
    "customerId" in change
      ? { customerId: other.id }
      : "gas" in change
        ? { lines: asLines([change]) }
        : change;

  const response = await agency.postCorrection(sent, correctionFor(sent, corrected), admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message,
    blockingBills: [{ id: writtenOff.id, number: writtenOff.number }],
  });
  expect(await agency.viewBill(sent.id)).toMatchObject({ lines: sent.lines, date: sent.date });
});

test("a refusal names the returns and the write-offs in the way together", async () => {
  const agency = await start();
  const { admin, customer, sent, customerWriteOff, receive, against, asLines } = agency;
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
    date: "2026-11-15",
  });
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 2, {
    date: "2026-11-20",
  });
  const lowered = { lines: asLines([{ gas: "Medical oxygen", quantity: 2 }]) };

  const response = await agency.postCorrection(
    sent,
    agency.correctionFor(sent, { ...lowered, date: "2026-11-16" }),
    admin,
  );

  expect(response.json()).toMatchObject({
    message:
      "Bill 1234 cannot have fewer than the 3 Medical oxygen returned or written off against it. " +
      "Bill 1234 cannot be dated after cylinders were returned against it. " +
      "Cancel the returns and write-offs in the way first, or change the correction.",
    blockingBills: [{ id: returned.id }, { id: writtenOff.id }],
  });
});

test("a refusal speaks only of what is in the way", async () => {
  const agency = await start();
  const { admin, customer, sent, customerWriteOff, receive, against, correctionFor } = agency;
  const writtenOff = await customerWriteOff(customer.id, sent, "Medical oxygen", 2, {
    date: "2026-11-12",
  });
  await receive(customer.id, [against(sent, "Medical oxygen", 1)], { date: "2026-11-20" });

  // After the write-off, but not the return.
  const response = await agency.postCorrection(
    sent,
    correctionFor(sent, { date: "2026-11-16" }),
    admin,
  );

  expect(response.json()).toMatchObject({
    message:
      "Bill 1234 cannot be dated after cylinders were written off against it. " +
      "Cancel the write-offs in the way first, or change the correction.",
    blockingBills: [{ id: writtenOff.id }],
  });
});

test("opening stock with a write-off is protected in the same way", async () => {
  const agency = await start();
  const { admin, customer, enter, customerWriteOff, asLines, correctionFor, postCancel } = agency;
  const opening = await enter(customer.id, [{ gas: "Argon", quantity: 4 }]);
  const writtenOff = await customerWriteOff(customer.id, opening, "Argon", 3);
  const blockingBills = [{ id: writtenOff.id, number: writtenOff.number }];

  const cancellation = await postCancel(opening, undefined, admin);
  const correction = await agency.postCorrection(
    opening,
    correctionFor(opening, { lines: asLines([{ gas: "Argon", quantity: 2 }]) }),
    admin,
  );

  expect(cancellation.json()).toMatchObject({
    message: "Opening stock has write-offs matched to it. Cancel those first.",
    blockingBills,
  });
  expect(correction.json()).toMatchObject({
    message:
      "Opening stock cannot have fewer than the 3 Argon written off against it. " +
      "Cancel the write-offs in the way first, or change the correction.",
    blockingBills,
  });
});

test("raising a quantity on a bill with a write-off updates what is pending", async () => {
  const { customer, sent, customerWriteOff, correct, asLines, pending } = await start();
  await customerWriteOff(customer.id, sent, "Medical oxygen", 2);

  const corrected = await correct(sent, {
    lines: asLines([{ gas: "Medical oxygen", quantity: 6 }]),
  });

  expect(corrected.returns).toMatchObject({ sent: 6, writtenOff: 2, pending: 4 });
  expect(await pending(customer.id)).toMatchObject([{ sent: 6, writtenOff: 2, pending: 4 }]);
});

// Which of two saves at once gets there first is left to chance, so each pair is
// sent several times over, on a customer of its own each time.
const TIMES = 5;

test("a write-off and a return sent at the same moment cannot over-clear a bill", async () => {
  const agency = await start();
  const { admin, addParty, dispatch, returnFor, postReturn, against } = agency;
  for (let time = 0; time < TIMES; time += 1) {
    const { id } = await addParty("customer", `Clinic ${time}`);
    const sent = await dispatch(id);
    // Of the 5 pending, either of these fits but not both.
    const writeOff = agency.customerWriteOffFor(id, sent, "Medical oxygen", 3);
    const payload = returnFor(id, [against(sent, "Medical oxygen", 3)]);
    await agency.openConnections();

    const [writtenOff, returned] = await Promise.all([
      agency.postCustomerWriteOff(writeOff, admin),
      postReturn(payload),
    ]);

    expect([writtenOff.statusCode, returned.statusCode].sort()).toEqual([201, 409]);
    const refused = writtenOff.statusCode === 409 ? writtenOff : returned;
    expect(refused.json()).toMatchObject({
      message: expect.stringMatching(/has only 2 Medical oxygen pending\.$/) as string,
    });
    expect(await agency.pending(id)).toMatchObject([{ pending: 2 }]);
  }
});

test("a customer's holding stays pending minus unmatched through write-offs", async () => {
  const agency = await start();
  const { customer, sent, customerWriteOff, receive, unmatchedRow, dispatch, against } = agency;
  const { match, cancel, pending, unmatchedList, report } = agency;
  /** What the customer holds, as the report has it, and as pending and unmatched make it. */
  async function oxygen() {
    // The only customer, so the report's customers are this one.
    const holding = (await report()).rows.find(
      (row) => row.gas.name === "Medical oxygen",
    )?.customers;
    const sum = (rows: { quantity: number }[]) =>
      rows.reduce((total, row) => total + row.quantity, 0);
    const stillPending = (await pending(customer.id)).reduce(
      (total, row) => total + row.pending,
      0,
    );
    const unmatched = sum((await unmatchedList()).rows);
    return { holding, pending: stillPending, unmatched };
  }

  const first = await customerWriteOff(customer.id, sent, "Medical oxygen", 2);
  expect(await oxygen()).toEqual({ holding: 3, pending: 3, unmatched: 0 });

  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 3)], {
    unmatched: [unmatchedRow("Medical oxygen", 4)],
  });
  expect(await oxygen()).toEqual({ holding: -4, pending: 0, unmatched: 4 });

  const missing = await dispatch(customer.id);
  const second = await customerWriteOff(customer.id, missing, "Medical oxygen", 1);
  expect(await oxygen()).toEqual({ holding: 0, pending: 4, unmatched: 4 });

  await match(returned, against(missing, "Medical oxygen", 4));
  expect(await oxygen()).toEqual({ holding: 0, pending: 0, unmatched: 0 });

  await cancel(second);
  expect(await oxygen()).toEqual({ holding: 1, pending: 1, unmatched: 0 });

  await cancel(first);
  expect(await oxygen()).toEqual({ holding: 3, pending: 3, unmatched: 0 });
});
