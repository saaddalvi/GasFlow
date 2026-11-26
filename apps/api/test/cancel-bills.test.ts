import { billSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/** The agency, with a customer to send cylinders to. */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");
  return { ...agency, customer };
}

test("staff cancel a bill, which stays visible with who cancelled it, when and why", async () => {
  const { clock, staff, customer, dispatch, postCancel, viewBill, me } = await start();
  const sent = await dispatch(customer.id, { number: "1234" });
  expect(sent.cancellation).toBeNull();
  clock.set("2026-11-26T07:15:00.000Z");

  const response = await postCancel(sent, {
    reason: "customer_rejected",
    notes: "  Sent back at the gate.  ",
  });

  expect(response.statusCode).toBe(200);
  const cancelled = billSchema.parse(response.json());
  expect(cancelled).toMatchObject({
    id: sent.id,
    number: "1234",
    status: "cancelled",
    lines: sent.lines,
    enteredBy: sent.enteredBy,
    enteredAt: sent.enteredAt,
  });
  expect(cancelled.cancellation).toEqual({
    reason: "customer_rejected",
    notes: "Sent back at the gate.",
    cancelledBy: { id: (await me(staff.headers)).id, displayName: "Ravi Shah" },
    cancelledAt: "2026-11-26T07:15:00.000Z",
  });
  expect(await viewBill(sent.id)).toEqual(cancelled);
});

test("notes are optional, and blank ones are not kept", async () => {
  const { customer, dispatch, cancel } = await start();
  const first = await dispatch(customer.id);
  const second = await dispatch(customer.id);

  expect((await cancel(first, { reason: "bill_voided" })).cancellation?.notes).toBeNull();
  expect((await cancel(second, { reason: "other", notes: "   " })).cancellation?.notes).toBeNull();
});

test.each([
  "data_entry_error",
  "duplicate_entry",
  "customer_rejected",
  "wrong_cylinder_loaded",
  "bill_voided",
  "other",
])("a bill can be cancelled with the reason %s", async (reason) => {
  const { customer, dispatch, cancel } = await start();

  const cancelled = await cancel(await dispatch(customer.id), { reason });

  expect(cancelled.cancellation?.reason).toBe(reason);
});

test.each([
  ["no reason", {}, "Choose why the bill is cancelled."],
  ["a blank reason", { reason: "" }, "Choose why the bill is cancelled."],
  ["a reason of its own", { reason: "changed my mind" }, "Choose why the bill is cancelled."],
  [
    "notes that are too long",
    { reason: "other", notes: "x".repeat(1001) },
    "Use notes of at most 1000 characters.",
  ],
])("a cancellation with %s is refused", async (_case, payload, message) => {
  const { customer, dispatch, postCancel, viewBill } = await start();
  const sent = await dispatch(customer.id);

  const response = await postCancel(sent, payload);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await viewBill(sent.id)).toEqual(sent);
});

test("a cancelled bill cannot be cancelled again or brought back", async () => {
  const { admin, customer, dispatch, cancel, postCancel, viewBill } = await start();
  const sent = await dispatch(customer.id);
  const cancelled = await cancel(sent, { reason: "duplicate_entry" });

  const response = await postCancel(sent, { reason: "other", status: "posted" }, admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "This bill has already been cancelled." });
  // Who cancelled it first, and why, stays as it was.
  expect(await viewBill(sent.id)).toEqual(cancelled);
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "1234"])(
  "there is no bill %s to cancel",
  async (id) => {
    const { postCancel } = await start();

    const response = await postCancel({ id });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such bill." });
  },
);

test("someone signed out cannot cancel a bill", async () => {
  const { app, customer, dispatch, viewBill } = await start();
  const sent = await dispatch(customer.id);

  const response = await app.inject({
    method: "POST",
    url: `/api/bills/${sent.id}/cancel`,
    payload: { reason: "other" },
  });

  expect(response.statusCode).toBe(401);
  expect(await viewBill(sent.id)).toEqual(sent);
});

/** What a customer holds of a gas, and what makes it up. */
async function counts(
  { customer, pending, unmatchedList, figures }: Awaited<ReturnType<typeof start>>,
  name = "Medical oxygen",
) {
  const sum = (rows: { gas: { name: string }; quantity: number }[]) =>
    rows.filter((row) => row.gas.name === name).reduce((total, row) => total + row.quantity, 0);
  return {
    holding: (await figures(name))?.customers,
    pending: sum(
      (await pending(customer.id)).map(({ gas, pending: quantity }) => ({ gas, quantity })),
    ),
    unmatched: sum((await unmatchedList()).rows),
  };
}

test("holdings, shop counts and pending follow a bill's life from start to finish", async () => {
  const agency = await start();
  const { shop, customer, enter, dispatch, receive, against, cancel, pending, figures } = agency;
  const filled = async () => (await figures("Medical oxygen"))?.shop;

  await enter(shop.id, [{ gas: "Medical oxygen", fillState: "filled", quantity: 20 }]);
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 4 }]);
  expect(await counts(agency)).toEqual({ holding: 4, pending: 4, unmatched: 0 });
  expect(await filled()).toEqual({ filled: 20, empty: 0, defective: 0 });

  const sent = await dispatch(customer.id, { date: "2026-11-20" });
  expect(await counts(agency)).toEqual({ holding: 9, pending: 9, unmatched: 0 });
  expect(await filled()).toEqual({ filled: 15, empty: 0, defective: 0 });

  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 3)]);
  expect(await counts(agency)).toEqual({ holding: 6, pending: 6, unmatched: 0 });
  expect(await filled()).toEqual({ filled: 15, empty: 3, defective: 0 });

  await cancel(returned);
  expect(await counts(agency)).toEqual({ holding: 9, pending: 9, unmatched: 0 });
  expect(await filled()).toEqual({ filled: 15, empty: 0, defective: 0 });
  expect(await pending(customer.id)).toMatchObject([
    { bill: { id: opening.id }, returned: 0, pending: 4 },
    { bill: { id: sent.id }, returned: 0, pending: 5 },
  ]);

  const late = await dispatch(customer.id, { date: "2026-11-10" });
  expect(await counts(agency)).toEqual({ holding: 14, pending: 14, unmatched: 0 });
  expect(await filled()).toEqual({ filled: 10, empty: 0, defective: 0 });

  await cancel(late);
  expect(await counts(agency)).toEqual({ holding: 9, pending: 9, unmatched: 0 });
  expect(await filled()).toEqual({ filled: 15, empty: 0, defective: 0 });
});

test("a cancelled return restores pending on every bill it was allocated to", async () => {
  const { customer, dispatch, receive, against, cancel, pending, viewBill, closed } = await start();
  const first = await dispatch(customer.id, { date: "2026-11-10" });
  const second = await dispatch(customer.id, { date: "2026-11-20" });
  const kept = await receive(customer.id, [against(first, "Medical oxygen", 1)]);
  const wrong = await receive(customer.id, [
    against(first, "Medical oxygen", 4),
    against(second, "Medical oxygen", 2),
  ]);
  expect(await closed(customer.id)).toMatchObject({ total: 1 });

  await cancel(wrong);

  expect(await pending(customer.id)).toMatchObject([
    { bill: { id: first.id }, returned: 1, pending: 4 },
    { bill: { id: second.id }, returned: 0, pending: 5 },
  ]);
  expect(await closed(customer.id)).toMatchObject({ total: 0 });
  expect((await viewBill(first.id)).returns).toMatchObject({
    returned: 1,
    pending: 4,
    status: "partly_returned",
    entries: [{ id: kept.id }],
  });
  expect((await viewBill(second.id)).returns).toMatchObject({ status: "open", entries: [] });
});

test("a cancelled return leaves the unmatched list, and what was matched to it is pending again", async () => {
  const agency = await start();
  const { customer, receive, unmatchedRow, dispatch, against, match, cancel } = agency;
  const returned = await receive(customer.id, [], {
    unmatched: [unmatchedRow("Medical oxygen", 3)],
  });
  const missing = await dispatch(customer.id, { date: "2026-11-20" });
  await match(returned, against(missing, "Medical oxygen", 1));
  expect(await counts(agency)).toEqual({ holding: 2, pending: 4, unmatched: 2 });

  await cancel(returned);

  expect(await counts(agency)).toEqual({ holding: 5, pending: 5, unmatched: 0 });
});

test("a cancelled dispatch bill has nothing pending and takes no part in any figure", async () => {
  const agency = await start();
  const { customer, dispatch, cancel, pending, closed, returnCustomers, viewBill, get } = agency;
  const sent = await dispatch(customer.id, { number: "1234" });

  await cancel(sent);

  expect(await counts(agency)).toEqual({ holding: 0, pending: 0, unmatched: 0 });
  expect(await agency.figures("Medical oxygen")).toMatchObject({ customers: 0, total: 0 });
  expect(await pending(customer.id)).toEqual([]);
  expect(await closed(customer.id)).toMatchObject({ total: 0 });
  expect(await returnCustomers()).toMatchObject({ customers: [{ pending: 0 }] });
  expect((await viewBill(sent.id)).returns).toBeNull();
  const use = await get("/api/bills/number-use?paperKind=bill&number=1234");
  expect(use.json()).toEqual({ usedBy: null });
});

test.each([
  ["send to refiller", "send"],
  ["return from refiller", "refillerReturn"],
] as const)("a cancelled %s moves no cylinders", async (_name, kind) => {
  const agency = await start();
  const refiller = await agency.addParty("refiller", "Zenith Gases");
  const bill = await agency[kind](refiller.id);

  await agency.cancel(bill);

  expect(await agency.figures("Medical oxygen")).toEqual({
    shop: { filled: 0, empty: 0, defective: 0 },
    customers: 0,
    refillers: 0,
    total: 0,
  });
});

test("cancelled opening stock leaves the list and every figure, and can be entered again", async () => {
  const { shop, customer, enter, cancel, figures, get, admin, viewBill } = await start();
  for (const party of [shop, customer]) {
    const wrong = await enter(party.id, [{ gas: "Argon", quantity: 7 }]);

    await cancel(wrong);

    expect(await figures("Argon")).toMatchObject({ customers: 0, total: 0 });
    const list = await get("/api/opening-stock");
    expect(list.json()).toMatchObject({ total: 0 });
    const offered = await get("/api/opening-stock/parties", admin);
    expect(offered.json<{ parties: { id: string }[] }>().parties).toContainEqual(
      expect.objectContaining({ id: party.id }),
    );

    const again = await enter(party.id, [{ gas: "Argon", quantity: 2 }]);

    expect(again.number).not.toBe(wrong.number);
    expect(await figures("Argon")).toMatchObject({ total: 2 });
    expect((await viewBill(wrong.id)).status).toBe("cancelled");
    await cancel(again);
  }
});

test.each([
  ["dispatch", "dispatch", "1234"],
  ["send to refiller", "send", "1234"],
  ["return from refiller", "refillerReturn", "ZG-551"],
] as const)("a cancelled %s's number can be used again", async (_name, kind, number) => {
  const agency = await start();
  const party =
    kind === "dispatch" ? agency.customer : await agency.addParty("refiller", "Zenith Gases");
  const wrong = await agency[kind](party.id, { number });
  await agency.cancel(wrong);

  const again = await agency[kind](party.id, { number });

  expect(again).toMatchObject({ number, status: "posted" });
});

test("the bill list can show only posted bills, or only cancelled ones", async () => {
  const { customer, dispatch, cancel, bills } = await start();
  const wrong = await dispatch(customer.id, { number: "1" });
  await dispatch(customer.id, { number: "2" });
  await cancel(wrong);
  const numbers = async (query: string) => {
    const list = await bills(query);
    expect(list.total).toBe(list.bills.length);
    return list.bills.map((bill) => bill.number).sort();
  };

  expect(await numbers("status=posted")).toEqual(["2"]);
  expect(await numbers("status=cancelled")).toEqual(["1"]);
  expect(await numbers("")).toEqual(["1", "2"]);
  // As the filter's form sends it when every status is wanted.
  expect(await numbers("status=")).toEqual(["1", "2"]);
});

test("the bill list refuses a status that no bill has", async () => {
  const { get } = await start();

  const response = await get("/api/bills?status=draft");

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Choose posted or cancelled." });
});

test("a filtered bill list comes a page at a time", async () => {
  const { customer, dispatch, cancel, bills } = await start();
  for (let count = 0; count < 51; count += 1) {
    await cancel(await dispatch(customer.id));
  }
  await dispatch(customer.id);

  expect(await bills("status=cancelled&page=2")).toMatchObject({ total: 51, page: 2 });
  expect((await bills("status=cancelled&page=2")).bills).toHaveLength(1);
});

const NOT_THEIRS = "You can cancel only bills you entered today. Ask an admin to cancel this one.";

test("staff cannot cancel a bill that someone else entered", async () => {
  const { signIn, customer, dispatch, postCancel, viewBill } = await start();
  const colleague = await signIn({ displayName: "Meena Iyer" });
  const sent = await dispatch(customer.id);

  const response = await postCancel(sent, { reason: "other" }, colleague);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: NOT_THEIRS });
  expect(await viewBill(sent.id)).toEqual(sent);
});

test.each([
  // Midnight in India is 18:30 the evening before in UTC.
  ["as the day starts", "2026-11-25T18:30:00.000Z", "2026-11-25T18:30:00.000Z"],
  ["until the day ends", "2026-11-25T18:30:00.000Z", "2026-11-26T18:29:59.999Z"],
])("staff cancel a bill they entered today in India, %s", async (_case, entered, cancelledAt) => {
  const { clock, customer, dispatch, postCancel } = await start();
  clock.set(entered);
  const sent = await dispatch(customer.id);
  clock.set(cancelledAt);

  const response = await postCancel(sent);

  expect(response.statusCode).toBe(200);
});

test.each([
  // A minute apart, on either side of midnight in India, on one day in UTC.
  ["a minute before midnight", "2026-11-26T18:29:00.000Z", "2026-11-26T18:30:00.000Z"],
  ["on an earlier day", "2026-11-20T06:30:00.000Z", "2026-11-26T06:30:00.000Z"],
])("staff cannot cancel a bill they entered %s", async (_case, entered, askedAt) => {
  const { clock, customer, dispatch, postCancel, viewBill } = await start();
  clock.set(entered);
  const sent = await dispatch(customer.id, { date: "2026-11-20" });
  clock.set(askedAt);

  const response = await postCancel(sent);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: NOT_THEIRS });
  expect((await viewBill(sent.id)).status).toBe("posted");
});

test("today is when a bill was entered, whatever date it has", async () => {
  const { customer, dispatch, postCancel } = await start();
  const late = await dispatch(customer.id, { date: "2026-11-02" });

  const response = await postCancel(late);

  expect(response.statusCode).toBe(200);
});

test("an admin cancels any bill, whoever entered it and whenever", async () => {
  const { clock, admin, customer, dispatch, postCancel, me } = await start();
  const sent = await dispatch(customer.id);
  clock.set("2027-03-15T06:30:00.000Z");

  const response = await postCancel(sent, { reason: "other" }, admin);

  expect(response.statusCode).toBe(200);
  const { cancellation, enteredBy } = billSchema.parse(response.json());
  expect(cancellation?.cancelledBy.id).toBe((await me(admin.headers)).id);
  expect(enteredBy.id).not.toBe(cancellation?.cancelledBy.id);
});

test("only an admin cancels opening stock, even for someone who entered it today", async () => {
  const { identity, signIn, customer, asLines, postOpeningStock, postCancel, viewBill } =
    await start();
  const former = await signIn({ displayName: "Meena Iyer", isAdmin: true });
  const saved = await postOpeningStock(
    { partyId: customer.id, lines: asLines([{ gas: "Argon", quantity: 1 }]) },
    former,
  );
  const opening = billSchema.parse(saved.json());
  identity.removeAdmin(former.identityId);

  for (const person of [former, undefined]) {
    const response = await postCancel(opening, { reason: "other" }, person);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ message: "Only an admin can cancel opening stock." });
  }
  expect((await viewBill(opening.id)).status).toBe("posted");
});

test("staff cancel a return they received today", async () => {
  const { customer, dispatch, receive, against, postCancel, pending } = await start();
  const sent = await dispatch(customer.id);
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 2)]);

  const response = await postCancel(returned);

  expect(response.statusCode).toBe(200);
  expect(await pending(customer.id)).toMatchObject([{ returned: 0, pending: 5 }]);
});

test("a dispatch bill with returns cannot be cancelled, and the refusal gives each of them", async () => {
  const { admin, customer, dispatch, asLines, receive, against, postCancel, viewBill, pending } =
    await start();
  const sent = await dispatch(customer.id, {
    number: "1234",
    date: "2026-11-10",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  const other = await dispatch(customer.id, { date: "2026-11-11" });
  const later = await receive(customer.id, [
    against(sent, "Medical oxygen", 1),
    against(sent, "Argon", 1),
  ]);
  const earlier = await receive(customer.id, [against(sent, "Medical oxygen", 1)], {
    date: "2026-11-15",
  });
  // Neither of these stands in the way.
  await receive(customer.id, [against(other, "Medical oxygen", 1)]);
  const cancelledFirst = await receive(customer.id, [against(sent, "Medical oxygen", 1)]);
  expect((await postCancel(cancelledFirst)).statusCode).toBe(200);

  const response = await postCancel(sent, { reason: "bill_voided" }, admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Bill 1234 has returns matched to it. Cancel those first.",
    // The oldest first, each named once.
    blockingBills: [
      { id: earlier.id, number: earlier.number },
      { id: later.id, number: later.number },
    ],
  });
  expect(await viewBill(sent.id)).toMatchObject({ status: "posted", cancellation: null });
  expect(await pending(customer.id)).toMatchObject([
    { bill: { id: sent.id }, returned: 2 },
    { bill: { id: sent.id }, returned: 1 },
    { bill: { id: other.id }, returned: 1 },
  ]);
});

test("a dispatch bill can be cancelled once its returns have been", async () => {
  const { customer, dispatch, receive, against, cancel, postCancel, figures } = await start();
  const sent = await dispatch(customer.id);
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 5)]);
  await cancel(returned);

  const response = await postCancel(sent);

  expect(response.statusCode).toBe(200);
  expect(await figures("Medical oxygen")).toMatchObject({ customers: 0, total: 0 });
});

test("opening stock with returns cannot be cancelled until they are", async () => {
  const { admin, customer, enter, receive, against, cancel, postCancel } = await start();
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 4 }]);
  const returned = await receive(customer.id, [against(opening, "Medical oxygen", 1)]);

  const refused = await postCancel(opening, { reason: "other" }, admin);

  expect(refused.statusCode).toBe(409);
  expect(refused.json()).toMatchObject({
    message: "Opening stock has returns matched to it. Cancel those first.",
    blockingBills: [{ id: returned.id, number: returned.number }],
  });
  await cancel(returned);
  expect((await postCancel(opening, { reason: "other" }, admin)).statusCode).toBe(200);
});

test("a return matched to a bill later stands in the way of cancelling it too", async () => {
  const { customer, receive, unmatchedRow, dispatch, against, match, postCancel } = await start();
  const returned = await receive(customer.id, [], {
    unmatched: [unmatchedRow("Medical oxygen", 3)],
  });
  const missing = await dispatch(customer.id, { number: "77", paperKind: "cash_memo" });
  await match(returned, against(missing, "Medical oxygen", 1));

  const response = await postCancel(missing);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Cash memo 77 has returns matched to it. Cancel those first.",
    blockingBills: [{ id: returned.id }],
  });
});

test("whether someone may cancel a bill is settled before what stands in the way", async () => {
  const { signIn, customer, dispatch, receive, against, postCancel } = await start();
  const colleague = await signIn({ displayName: "Meena Iyer" });
  const sent = await dispatch(customer.id);
  await receive(customer.id, [against(sent, "Medical oxygen", 1)]);

  const response = await postCancel(sent, { reason: "other" }, colleague);

  expect(response.statusCode).toBe(403);
  expect(response.json()).not.toHaveProperty("blockingBills");
});

test("cylinders cannot be returned against a bill that has been cancelled", async () => {
  const { customer, dispatch, cancel, returnFor, postReturn, against, bills } = await start();
  const sent = await dispatch(customer.id, { number: "1234" });
  await cancel(sent);

  const response = await postReturn(returnFor(customer.id, [against(sent, "Medical oxygen", 1)]));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "Bill 1234 has been cancelled." });
  expect(await bills()).toMatchObject({ total: 1 });
});

test("cylinders cannot be returned against opening stock that has been cancelled", async () => {
  const { customer, enter, cancel, returnFor, postReturn, against } = await start();
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 4 }]);
  await cancel(opening);

  const response = await postReturn(
    returnFor(customer.id, [against(opening, "Medical oxygen", 1)]),
  );

  expect(response.statusCode).toBe(409);
  // As Receive empties names it, which never shows its number.
  expect(response.json()).toMatchObject({ message: "Opening stock has been cancelled." });
});

test("cylinders on a cancelled return cannot be matched to a bill", async () => {
  const { customer, receive, unmatchedRow, dispatch, against, cancel, postMatch, pending } =
    await start();
  const returned = await receive(customer.id, [], {
    unmatched: [unmatchedRow("Medical oxygen", 3)],
  });
  const missing = await dispatch(customer.id);
  await cancel(returned);

  const response = await postMatch(returned, against(missing, "Medical oxygen", 1));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: `${returned.number} has been cancelled.`,
  });
  expect(await pending(customer.id)).toMatchObject([{ returned: 0, pending: 5 }]);
});

// Which of two saves at once gets there first is left to chance, so each pair is
// sent several times over, on a customer of its own each time.
const TIMES = 5;

test("a cancellation and a return against the same bill sent at once cannot both succeed", async () => {
  const agency = await start();
  const { addParty, dispatch, returnFor, postReturn, postCancel, against, openConnections } =
    agency;
  for (let time = 0; time < TIMES; time += 1) {
    const { id } = await addParty("customer", `Clinic ${time}`);
    const sent = await dispatch(id);
    const payload = returnFor(id, [against(sent, "Medical oxygen", 2)]);
    await openConnections();

    const [cancellation, returned] = await Promise.all([postCancel(sent), postReturn(payload)]);

    // Either the bill went first and had nothing returned against it, or the
    // return did and the bill stayed.
    const cancelled = cancellation.statusCode === 200;
    expect([cancellation.statusCode, returned.statusCode]).toEqual(
      cancelled ? [200, 409] : [409, 201],
    );
    expect(await agency.viewBill(sent.id)).toMatchObject({
      status: cancelled ? "cancelled" : "posted",
    });
    expect(await agency.pending(id)).toMatchObject(cancelled ? [] : [{ returned: 2 }]);
  }
});

test("a cancellation and a match to the same bill sent at once cannot both succeed", async () => {
  const agency = await start();
  const { addParty, dispatch, receive, unmatchedRow, postMatch, postCancel, against } = agency;
  for (let time = 0; time < TIMES; time += 1) {
    const { id } = await addParty("customer", `Clinic ${time}`);
    const returned = await receive(id, [], { unmatched: [unmatchedRow("Medical oxygen", 3)] });
    const sent = await dispatch(id);
    await agency.openConnections();

    const [cancellation, matched] = await Promise.all([
      postCancel(sent),
      postMatch(returned, against(sent, "Medical oxygen", 2)),
    ]);

    expect([cancellation.statusCode, matched.statusCode]).toEqual(
      cancellation.statusCode === 200 ? [200, 409] : [409, 201],
    );
  }
});

test("of several cancellations of one bill sent at once, one is kept", async () => {
  const { admin, customer, dispatch, postCancel, openConnections, viewBill } = await start();
  const sent = await dispatch(customer.id);
  const reasons = ["data_entry_error", "duplicate_entry", "bill_voided", "other"];
  await openConnections();

  const responses = await Promise.all(reasons.map((reason) => postCancel(sent, { reason }, admin)));

  expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409, 409, 409]);
  const kept = responses.find((response) => response.statusCode === 200)!;
  expect(await viewBill(sent.id)).toEqual(billSchema.parse(kept.json()));
});
