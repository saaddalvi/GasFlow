import { billSchema, type Bill } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

/** The agency, with a customer to send cylinders to. */
async function start() {
  const agency = await startAgency();
  const customer = await agency.addParty("customer", "City Hospital");
  return { ...agency, customer };
}

test("staff correct a dispatch bill, and every figure follows", async () => {
  const agency = await start();
  const { customer, addParty, addVehicle, asLines, dispatch, correctionFor, postCorrection } =
    agency;
  const other = await addParty("customer", "Lotus Clinic");
  const vehicle = await addVehicle({ plate: "MH-12 AB 1234" });
  const sent = await dispatch(customer.id, { number: "1234" });

  const response = await postCorrection(
    sent,
    correctionFor(sent, {
      paperKind: "cash_memo",
      number: "88",
      date: "2026-11-20",
      customerId: other.id,
      vehicleId: vehicle.id,
      notes: "  Went to the clinic.  ",
      lines: asLines([
        { gas: "Argon", quantity: 2 },
        { gas: "Medical oxygen", fillState: "empty", quantity: 3 },
      ]),
    }),
  );

  expect(response.statusCode).toBe(200);
  const corrected = billSchema.parse(response.json());
  expect(corrected).toMatchObject({
    id: sent.id,
    type: "dispatch",
    paperKind: "cash_memo",
    number: "88",
    date: "2026-11-20",
    status: "posted",
    to: { id: other.id },
    vehicle: { id: vehicle.id },
    notes: "Went to the clinic.",
    lines: [
      { gas: { name: "Argon" }, fillState: "filled", quantity: 2 },
      { gas: { name: "Medical oxygen" }, fillState: "empty", quantity: 3 },
    ],
    // Correcting a bill does not change who entered it.
    enteredBy: sent.enteredBy,
    enteredAt: sent.enteredAt,
  });
  expect(await agency.viewBill(sent.id)).toEqual(corrected);
  expect(await agency.pending(customer.id)).toEqual([]);
  expect(await agency.pending(other.id)).toMatchObject([
    { bill: { id: sent.id, number: "88" }, gas: { name: "Argon" }, pending: 2 },
    { bill: { id: sent.id }, gas: { name: "Medical oxygen" }, pending: 3 },
  ]);
  expect(await agency.figures("Medical oxygen")).toMatchObject({
    shop: { filled: 0, empty: -3, defective: 0 },
    customers: 3,
  });
  expect(await agency.figures("Argon", "date=2026-11-20")).toMatchObject({ customers: 2 });
});

const NOT_THEIRS =
  "You can correct only bills you entered today. Ask an admin to correct this one.";

/** One line of five, raised to six: a correction nothing stands in the way of. */
const six = ({ asLines }: Awaited<ReturnType<typeof start>>) => ({
  lines: asLines([{ gas: "Medical oxygen", quantity: 6 }]),
});

test("staff cannot correct a bill that someone else entered", async () => {
  const agency = await start();
  const { signIn, customer, dispatch, correctionFor, postCorrection, viewBill } = agency;
  const colleague = await signIn({ displayName: "Meena Iyer" });
  const sent = await dispatch(customer.id);

  const response = await postCorrection(sent, correctionFor(sent, six(agency)), colleague);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: NOT_THEIRS });
  expect(await viewBill(sent.id)).toEqual(sent);
});

test.each([
  // Midnight in India is 18:30 the evening before in UTC.
  ["as the day starts", "2026-11-25T18:30:00.000Z", "2026-11-25T18:30:00.000Z"],
  ["until the day ends", "2026-11-25T18:30:00.000Z", "2026-11-26T18:29:59.999Z"],
])("staff correct a bill they entered today in India, %s", async (_case, entered, askedAt) => {
  const agency = await start();
  const { clock, customer, dispatch, correctionFor, postCorrection } = agency;
  clock.set(entered);
  const sent = await dispatch(customer.id);
  clock.set(askedAt);

  const response = await postCorrection(sent, correctionFor(sent, six(agency)));

  expect(response.statusCode).toBe(200);
});

test.each([
  // A minute apart, on either side of midnight in India, on one day in UTC.
  ["a minute before midnight", "2026-11-26T18:29:00.000Z", "2026-11-26T18:30:00.000Z"],
  ["on an earlier day", "2026-11-20T06:30:00.000Z", "2026-11-26T06:30:00.000Z"],
])("staff cannot correct a bill they entered %s", async (_case, entered, askedAt) => {
  const agency = await start();
  const { clock, customer, dispatch, correctionFor, postCorrection, viewBill } = agency;
  clock.set(entered);
  const sent = await dispatch(customer.id, { date: "2026-11-20" });
  clock.set(askedAt);

  const response = await postCorrection(sent, correctionFor(sent, six(agency)));

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: NOT_THEIRS });
  expect(await viewBill(sent.id)).toEqual(sent);
});

test("an admin corrects any bill, whoever entered it and whenever", async () => {
  const agency = await start();
  const { clock, admin, customer, dispatch, correctionFor, postCorrection } = agency;
  const sent = await dispatch(customer.id);
  clock.set("2027-03-15T06:30:00.000Z");

  const response = await postCorrection(sent, correctionFor(sent, six(agency)), admin);

  expect(response.statusCode).toBe(200);
  expect(billSchema.parse(response.json()).lines).toMatchObject([{ quantity: 6 }]);
});

test("only an admin corrects opening stock, even for someone who entered it today", async () => {
  const { identity, signIn, customer, asLines, postOpeningStock, ...agency } = await start();
  const former = await signIn({ displayName: "Meena Iyer", isAdmin: true });
  const saved = await postOpeningStock(
    { partyId: customer.id, lines: asLines([{ gas: "Argon", quantity: 1 }]) },
    former,
  );
  const opening = billSchema.parse(saved.json());
  identity.removeAdmin(former.identityId);

  for (const person of [former, undefined]) {
    const response = await agency.postCorrection(opening, agency.correctionFor(opening), person);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ message: "Only an admin can correct opening stock." });
  }
  expect(await agency.viewBill(opening.id)).toEqual(opening);
});

test.each(["staff", "admin"] as const)("a return is never corrected, by %s", async (who) => {
  const agency = await start();
  const { customer, dispatch, receive, against, viewBill, correctionFor, postCorrection } = agency;
  const sent = await dispatch(customer.id);
  const returned = await viewBill(
    (await receive(customer.id, [against(sent, "Medical oxygen", 2)])).id,
  );

  // Even sent as though it were a bill that can be.
  const response = await postCorrection(returned, correctionFor(sent), agency[who]);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "A return cannot be corrected. Cancel it and record it again.",
  });
  expect(await viewBill(returned.id)).toEqual(returned);
});

test("a cancelled bill cannot be corrected", async () => {
  const agency = await start();
  const { customer, dispatch, cancel, correctionFor, postCorrection, viewBill } = agency;
  const sent = await dispatch(customer.id);
  const cancelled = await cancel(sent);

  const response = await postCorrection(sent, correctionFor(sent, six(agency)));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "This bill has been cancelled, so it cannot be corrected.",
  });
  expect(await viewBill(sent.id)).toEqual(cancelled);
});

test("a correction cannot change the type of a bill", async () => {
  const { customer, addParty, dispatch, sendFor, postCorrection, viewBill } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  const sent = await dispatch(customer.id);

  const response = await postCorrection(sent, sendFor(refiller.id));

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "The type of a bill cannot be changed. Cancel it and enter it again.",
  });
  expect(await viewBill(sent.id)).toEqual(sent);
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "1234"])(
  "there is no bill %s to correct",
  async (id) => {
    const { customer, dispatchFor, postCorrection } = await start();

    const response = await postCorrection({ id }, dispatchFor(customer.id));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such bill." });
  },
);

test.each([
  ["no type", { type: undefined }, "Choose the type of bill."],
  ["a return's type", { type: "return_from_customer" }, "Choose the type of bill."],
  ["no lines", { lines: [] }, "Add at least one line."],
  ["a blank number", { number: " " }, "Enter the bill number."],
])("a correction with %s is refused", async (_case, change, message) => {
  const { customer, dispatch, correctionFor, postCorrection, viewBill } = await start();
  const sent = await dispatch(customer.id);

  const response = await postCorrection(sent, correctionFor(sent, change));

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await viewBill(sent.id)).toEqual(sent);
});

test("someone signed out cannot correct a bill", async () => {
  const { app, customer, dispatch, correctionFor, viewBill } = await start();
  const sent = await dispatch(customer.id);

  const response = await app.inject({
    method: "PUT",
    url: `/api/bills/${sent.id}`,
    payload: correctionFor(sent),
  });

  expect(response.statusCode).toBe(401);
  expect(await viewBill(sent.id)).toEqual(sent);
});

/** Asserts that the admin's correction is turned down and the bill left as it was. */
async function expectRefused(
  { admin, correctionFor, postCorrection, viewBill }: Awaited<ReturnType<typeof start>>,
  bill: Bill,
  change: object,
  status: number,
  message: string,
) {
  const response = await postCorrection(bill, correctionFor(bill, change), admin);

  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ message });
  expect(await viewBill(bill.id)).toEqual(bill);
}

test("a bill cannot be corrected to a date before the start date", async () => {
  const agency = await start();
  const sent = await agency.dispatch(agency.customer.id);

  await expectRefused(
    agency,
    sent,
    { date: "2026-10-31" },
    409,
    "A bill cannot be dated before the start date.",
  );
  expect((await agency.correct(sent, { date: START_DATE })).date).toBe(START_DATE);
});

test.each([
  ["dispatch", "dispatch"],
  ["send to refiller", "send"],
] as const)("a bill cannot take the number of a %s on the same paper", async (_name, other) => {
  const agency = await start();
  const { customer, addParty, dispatch } = agency;
  const party = other === "dispatch" ? customer : await addParty("refiller", "Zenith Gases");
  await agency[other](party.id, { number: "ab-1" });
  const sent = await dispatch(customer.id, { number: "1234" });

  await expectRefused(agency, sent, { number: "AB-1" }, 409, "Bill number AB-1 is already in use.");
});

test("a bill cannot move to paper on which its number is taken", async () => {
  const agency = await start();
  const { customer, dispatch } = agency;
  await dispatch(customer.id, { paperKind: "cash_memo", number: "88" });
  const sent = await dispatch(customer.id, { number: "88" });

  await expectRefused(
    agency,
    sent,
    { paperKind: "cash_memo" },
    409,
    "Cash memo number 88 is already in use.",
  );
});

test("a corrected number is taken, and the one given up is free again", async () => {
  const { customer, dispatch, dispatchFor, postBill, correct } = await start();
  const sent = await dispatch(customer.id, { number: "1234" });

  await correct(sent, { number: "1235" });

  expect((await postBill(dispatchFor(customer.id, { number: "1235" }))).statusCode).toBe(409);
  expect((await postBill(dispatchFor(customer.id, { number: "1234" }))).statusCode).toBe(201);
});

test("a return from refiller cannot take a slip number in use for its refiller", async () => {
  const agency = await start();
  const zenith = await agency.addParty("refiller", "Zenith Gases");
  const apex = await agency.addParty("refiller", "Apex Gases");
  await agency.refillerReturn(zenith.id, { number: "ZG-1" });
  const wrong = await agency.refillerReturn(zenith.id, { number: "ZG-2" });
  const taken = "This refiller's slip number ZG-1 is already in use.";

  await expectRefused(agency, wrong, { number: "ZG-1" }, 409, taken);
  // Another refiller's slips are numbered apart.
  const moved = await agency.correct(wrong, { number: "ZG-1", refillerId: apex.id });
  expect(moved).toMatchObject({ number: "ZG-1", from: { id: apex.id } });
  await expectRefused(agency, moved, { refillerId: zenith.id }, 409, taken);
});

test("of corrections to one number sent at once, one is kept", async () => {
  const agency = await start();
  const { admin, customer, dispatch, correctionFor, postCorrection, openConnections } = agency;
  const sent = [];
  for (let count = 0; count < 4; count += 1) {
    sent.push(await dispatch(customer.id));
  }
  await openConnections();

  const responses = await Promise.all(
    sent.map((bill) => postCorrection(bill, correctionFor(bill, { number: "77" }), admin)),
  );

  expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409, 409, 409]);
});

test.each([
  ["send to refiller", "send"],
  ["return from refiller", "refillerReturn"],
] as const)("a %s is corrected, and every figure follows", async (_name, kind) => {
  const agency = await start();
  const zenith = await agency.addParty("refiller", "Zenith Gases");
  const apex = await agency.addParty("refiller", "Apex Gases");
  const bill = await agency[kind](zenith.id);

  const corrected = await agency.correct(bill, {
    refillerId: apex.id,
    date: "2026-11-20",
    lines: agency.asLines([{ gas: "Argon", fillState: "empty", quantity: 7 }]),
  });

  const toRefiller = kind === "send";
  expect(corrected).toMatchObject({
    type: bill.type,
    paperKind: bill.paperKind,
    date: "2026-11-20",
    [toRefiller ? "to" : "from"]: { id: apex.id },
    [toRefiller ? "from" : "to"]: { id: agency.shop.id },
    lines: [{ gas: { name: "Argon" }, quantity: 7 }],
  });
  expect(await agency.figures("Medical oxygen")).toMatchObject({ refillers: 0, total: 0 });
  expect(await agency.figures("Argon", "date=2026-11-20")).toMatchObject({
    shop: { empty: toRefiller ? -7 : 7 },
    refillers: toRefiller ? 7 : -7,
  });
});

test.each(["shop", "customer", "refiller"] as const)(
  "an admin corrects a %s's opening stock, which keeps its party, date and number",
  async (type) => {
    const agency = await start();
    const party = type === "shop" ? agency.shop : await agency.addParty(type, "Lotus");
    const wrong = await agency.enter(party.id, [{ gas: "Argon", quantity: 7 }]);

    const corrected = await agency.correct(wrong, {
      lines: agency.asLines([{ gas: "Argon", quantity: 2 }]),
      // None of these is part of a correction to opening stock.
      partyId: agency.customer.id,
      number: "MINE-1",
      date: "2026-11-20",
    });

    expect(corrected).toMatchObject({
      type: "opening_stock",
      number: wrong.number,
      date: START_DATE,
      to: wrong.to,
      lines: [{ gas: { name: "Argon" }, quantity: 2 }],
    });
    expect(await agency.figures("Argon", `date=${START_DATE}`)).toMatchObject({ total: 2 });
  },
);

test.each([
  [
    "dispatch",
    "customerId",
    "refiller",
    "Zenith is not a customer. A dispatch goes to a customer.",
  ],
  [
    "send",
    "refillerId",
    "customer",
    "Zenith is not a refiller. A send to refiller goes to a refiller.",
  ],
  [
    "refillerReturn",
    "refillerId",
    "supplier",
    "Zenith is not a refiller. A return from refiller comes from a refiller.",
  ],
] as const)(
  "a %s cannot be corrected to name a party of the wrong type",
  async (kind, field, type, message) => {
    const agency = await start();
    const right = kind === "dispatch" ? "customer" : "refiller";
    const bill = await agency[kind]((await agency.addParty(right, "Apex")).id);
    const wrong = await agency.addParty(type, "Zenith");

    await expectRefused(agency, bill, { [field]: wrong.id }, 409, message);
  },
);

/** Makes a party, vehicle or gas inactive, as an admin does. */
async function retire(
  { app, admin }: Awaited<ReturnType<typeof start>>,
  kind: "parties" | "vehicles" | "gases",
  { id }: { id: string },
) {
  const response = await app.inject({
    method: "PATCH",
    url: `/api/${kind}/${id}`,
    headers: admin.headers,
    payload: { active: false },
  });
  expect(response.statusCode).toBe(200);
}

test("a correction cannot newly name an inactive customer, but may keep the bill's own", async () => {
  const agency = await start();
  const { customer, addParty, dispatch, correct } = agency;
  const other = await addParty("customer", "Lotus Clinic");
  const sent = await dispatch(customer.id);
  await retire(agency, "parties", other);

  await expectRefused(
    agency,
    sent,
    { customerId: other.id },
    409,
    "Lotus Clinic is inactive. Make it active first.",
  );
  // Only a customer with nothing to bring back can be made inactive.
  await agency.receive(customer.id, [agency.against(sent, "Medical oxygen", 5)]);
  await retire(agency, "parties", customer);
  expect((await correct(sent, six(agency))).lines).toMatchObject([{ quantity: 6 }]);
});

test("a correction cannot newly name an inactive vehicle, but may keep the bill's own", async () => {
  const agency = await start();
  const { customer, addVehicle, dispatch, correct } = agency;
  const own = await addVehicle({ plate: "MH-12 AB 1234" });
  const other = await addVehicle({ plate: "MH-14 CD 5678" });
  const sent = await dispatch(customer.id, { vehicleId: own.id });
  await retire(agency, "vehicles", other);

  await expectRefused(
    agency,
    sent,
    { vehicleId: other.id },
    409,
    "MH-14 CD 5678 is inactive. Make it active first.",
  );
  await retire(agency, "vehicles", own);
  expect((await correct(sent, six(agency))).vehicle).toMatchObject({ id: own.id });
  expect((await correct(sent, { vehicleId: null })).vehicle).toBeNull();
});

test("a correction cannot add a retired gas, but may keep one the bill has", async () => {
  const agency = await start();
  const { customer, dispatch, asLines, gas, correct } = agency;
  const sent = await dispatch(customer.id);
  await retire(agency, "gases", gas("Argon"));

  await expectRefused(
    agency,
    sent,
    { lines: asLines([{ gas: "Argon", quantity: 1 }]) },
    409,
    "Argon is retired. Bring it back to use it.",
  );
  await retire(agency, "gases", gas("Medical oxygen"));
  expect((await correct(sent, six(agency))).lines).toMatchObject([{ quantity: 6 }]);
});

test.each([
  ["customer", { customerId: "0b8f2c6e-1f4a-4d0b-9c55-999999999999" }, "There is no such party."],
  ["vehicle", { vehicleId: "0b8f2c6e-1f4a-4d0b-9c55-999999999999" }, "There is no such vehicle."],
  [
    "gas",
    {
      lines: [{ gasId: "0b8f2c6e-1f4a-4d0b-9c55-999999999999", fillState: "filled", quantity: 1 }],
    },
    "There is no such gas.",
  ],
])("a correction naming a %s that does not exist is refused", async (_case, change, message) => {
  const agency = await start();
  const sent = await agency.dispatch(agency.customer.id);

  await expectRefused(agency, sent, change, 404, message);
});

test("a bill never corrected has no earlier versions", async () => {
  const { customer, dispatch } = await start();

  const sent = await dispatch(customer.id);

  expect(sent).toMatchObject({ lastCorrection: null, earlierVersions: [] });
});

test("each correction keeps the version before it, with who saved it and when", async () => {
  const agency = await start();
  const { clock, admin, staff, customer, addParty, addVehicle, asLines, dispatch, me } = agency;
  const other = await addParty("customer", "Lotus Clinic");
  const vehicle = await addVehicle({ plate: "MH-12 AB 1234", label: "Blue tempo" });
  const ravi = { id: (await me(staff.headers)).id, displayName: "Ravi Shah" };
  const asha = { id: (await me(admin.headers)).id, displayName: "Asha Patil" };
  const first = await dispatch(customer.id, {
    number: "1234",
    date: "2026-11-20",
    vehicleId: vehicle.id,
    notes: "First try.",
  });

  clock.set("2026-11-26T07:00:00.000Z");
  const saved = await agency.postCorrection(
    first,
    agency.correctionFor(first, {
      number: "1235",
      customerId: other.id,
      vehicleId: null,
      notes: null,
      lines: asLines([{ gas: "Argon", quantity: 2 }]),
    }),
  );
  const second = billSchema.parse(saved.json());
  clock.set("2026-11-27T08:00:00.000Z");
  const third = await agency.correct(second, { date: "2026-11-21" });

  const original = {
    paperKind: "bill",
    number: "1234",
    date: "2026-11-20",
    from: first.from,
    to: first.to,
    vehicle: first.vehicle,
    notes: "First try.",
    writeOffReason: null,
    lines: first.lines,
    savedBy: ravi,
    savedAt: "2026-11-26T06:30:00.000Z",
  };
  expect(second.lastCorrection).toEqual({
    correctedBy: ravi,
    correctedAt: "2026-11-26T07:00:00.000Z",
  });
  expect(second.earlierVersions).toEqual([original]);
  expect(third.lastCorrection).toEqual({
    correctedBy: asha,
    correctedAt: "2026-11-27T08:00:00.000Z",
  });
  expect(third.earlierVersions).toEqual([
    original,
    {
      paperKind: "bill",
      number: "1235",
      date: "2026-11-20",
      from: second.from,
      to: second.to,
      vehicle: null,
      notes: null,
      writeOffReason: null,
      lines: second.lines,
      savedBy: ravi,
      savedAt: "2026-11-26T07:00:00.000Z",
    },
  ]);
  expect(await agency.viewBill(first.id)).toEqual(third);
});

test("earlier versions name parties and vehicles as they were named then", async () => {
  const agency = await start();
  const { app, staff, customer, dispatch, correct, viewBill } = agency;
  const sent = await dispatch(customer.id);
  await correct(sent, six(agency));

  await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { name: "City General Hospital" },
  });

  const bill = await viewBill(sent.id);
  expect(bill.to?.name).toBe("City General Hospital");
  expect(bill.earlierVersions).toMatchObject([{ to: { name: "City Hospital" } }]);
});

test("earlier versions count towards no figure, and stay on a cancelled bill", async () => {
  const agency = await start();
  const { customer, dispatch, correct, cancel, figures } = agency;
  const sent = await dispatch(customer.id);

  const corrected = await correct(sent, six(agency));

  expect(await figures("Medical oxygen")).toMatchObject({ customers: 6 });
  const cancelled = await cancel(corrected);
  expect(cancelled.earlierVersions).toEqual(corrected.earlierVersions);
  expect(cancelled.lastCorrection).toEqual(corrected.lastCorrection);
});

test("corrections to one bill sent at once each keep the version they replaced", async () => {
  const agency = await start();
  const { admin, customer, dispatch, correctionFor, postCorrection, viewBill } = agency;
  const sent = await dispatch(customer.id, { number: "1" });
  await agency.openConnections();

  const responses = await Promise.all(
    ["2", "3", "4", "5"].map((number) =>
      postCorrection(sent, correctionFor(sent, { number }), admin),
    ),
  );

  expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200]);
  const bill = await viewBill(sent.id);
  const numbers = [...bill.earlierVersions.map((version) => version.number), bill.number];
  expect(numbers.sort()).toEqual(["1", "2", "3", "4", "5"]);
});

const ids = (bill: Bill) => bill.lines.map((line) => line.id);

test("raising a quantity on a bill with returns updates what is pending", async () => {
  const agency = await start();
  const { customer, dispatch, receive, against, correct, pending, viewBill, figures } = agency;
  const sent = await dispatch(customer.id);
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 5)]);
  expect((await viewBill(sent.id)).returns).toMatchObject({ status: "closed" });

  const corrected = await correct(sent, six(agency));

  expect(corrected.returns).toMatchObject({
    sent: 6,
    returned: 5,
    pending: 1,
    status: "partly_returned",
    entries: [{ id: returned.id, quantity: 5 }],
  });
  expect(await pending(customer.id)).toMatchObject([{ sent: 6, returned: 5, pending: 1 }]);
  expect(await figures("Medical oxygen")).toMatchObject({ customers: 1 });
});

test("a gas can be lowered to exactly what has been returned of it", async () => {
  const agency = await start();
  const { customer, dispatch, receive, against, correct, asLines } = agency;
  const sent = await dispatch(customer.id);
  await receive(customer.id, [against(sent, "Medical oxygen", 2)]);

  const corrected = await correct(sent, {
    lines: asLines([{ gas: "Medical oxygen", quantity: 2 }]),
  });

  expect(corrected.returns).toMatchObject({ sent: 2, returned: 2, pending: 0, status: "closed" });
});

test("lines with returns keep their identity through a correction", async () => {
  const { customer, dispatch, receive, against, correct, asLines, pending } = await start();
  const sent = await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 4 },
      { gas: "Argon", quantity: 2 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  const [oxygen, argon, emptyOxygen] = ids(sent);
  await receive(customer.id, [against(sent, "Medical oxygen", 5), against(sent, "Argon", 1)]);

  // Reordered, a quantity raised, a fill state changed and a line added.
  const corrected = await correct(sent, {
    lines: asLines([
      { gas: "Nitrogen", quantity: 3 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
      { gas: "Argon", fillState: "empty", quantity: 4 },
      { gas: "Medical oxygen", fillState: "filled", quantity: 6 },
    ]),
  });

  expect(ids(corrected).slice(1)).toEqual([emptyOxygen, argon, oxygen]);
  expect(ids(sent)).not.toContain(ids(corrected)[0]);
  expect(await pending(customer.id)).toMatchObject([
    { gas: { name: "Nitrogen" }, returned: 0, pending: 3 },
    { gas: { name: "Medical oxygen" }, sent: 7, returned: 5, pending: 2 },
    { gas: { name: "Argon" }, sent: 4, returned: 1, pending: 3 },
  ]);
});

test("a line with returns is kept before one without, however alike the other is", async () => {
  const { customer, dispatch, receive, against, correct, asLines } = await start();
  const sent = await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "empty", quantity: 5 },
      { gas: "Medical oxygen", fillState: "filled", quantity: 5 },
    ]),
  });
  // Matched to the first line of the gas.
  await receive(customer.id, [against(sent, "Medical oxygen", 2)]);

  // What is left reads as the second line did.
  const corrected = await correct(sent, {
    lines: asLines([{ gas: "Medical oxygen", fillState: "filled", quantity: 5 }]),
  });

  expect(ids(corrected)).toEqual([ids(sent)[0]]);
});

test.each([
  ["quantity", { fillState: "filled", quantity: 4 }],
  ["fill state", { fillState: "empty", quantity: 3 }],
] as const)(
  "a change to the %s of a line stays with that line after lines are added above it",
  async (_case, change) => {
    const { customer, dispatch, receive, against, correct, asLines } = await start();
    const oxygen = (...lines: { fillState: "filled" | "empty"; quantity: number }[]) =>
      asLines(lines.map((line) => ({ gas: "Medical oxygen", ...line })));
    const above = { fillState: "filled", quantity: 5 } as const;
    const sent = await dispatch(customer.id, {
      lines: oxygen({ fillState: "filled", quantity: 3 }),
    });
    await receive(customer.id, [against(sent, "Medical oxygen", 2)]);
    const added = await correct(sent, {
      lines: oxygen(above, { fillState: "filled", quantity: 3 }),
    });
    expect(ids(added)[1]).toBe(ids(sent)[0]);

    const changed = await correct(added, { lines: oxygen(above, change) });

    expect(ids(changed)).toEqual(ids(added));
  },
);

test.each([
  ["merged into one", [5]],
  ["split another way", [2, 3]],
  ["lowered on one and raised on another", [1, 6]],
  ["put in place of by three", [1, 1, 3]],
])(
  "returns stay matched to a gas whose lines are %s, and can be cancelled",
  async (_case, quantities) => {
    const agency = await start();
    const { customer, dispatch, receive, against, correct, cancel, asLines, pending } = agency;
    const lines = (...counts: number[]) =>
      asLines(counts.map((quantity) => ({ gas: "Medical oxygen", quantity })));
    const sent = await dispatch(customer.id, { lines: lines(4, 1) });
    const first = await receive(customer.id, [against(sent, "Medical oxygen", 3)]);
    // Entered later, so that it is listed after.
    agency.clock.set("2026-11-26T07:00:00.000Z");
    const second = await receive(customer.id, [against(sent, "Medical oxygen", 2)]);

    const corrected = await correct(sent, { lines: lines(...quantities) });

    const total = quantities.reduce((sum, quantity) => sum + quantity, 0);
    expect(corrected.returns).toMatchObject({
      sent: total,
      returned: 5,
      pending: total - 5,
      entries: [
        { id: first.id, quantity: 3 },
        { id: second.id, quantity: 2 },
      ],
    });
    // Whatever is left pending can all be returned, and no more.
    if (total > 5) {
      await receive(customer.id, [against(sent, "Medical oxygen", total - 5)]);
    }
    expect(await pending(customer.id)).toEqual([]);
    await cancel(first);
    expect(await pending(customer.id)).toMatchObject([{ pending: 3 }]);
    await cancel(second);
    expect(await pending(customer.id)).toMatchObject([{ pending: 5 }]);
  },
);

/** A dispatch of 5 oxygen and 2 argon on 10 November, with returns on two later days. */
async function sendAndReceive() {
  const agency = await start();
  const { customer, dispatch, receive, against, asLines, viewBill } = agency;
  const sent = await dispatch(customer.id, {
    number: "1234",
    date: "2026-11-10",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  const argon = await receive(customer.id, [against(sent, "Argon", 1)], { date: "2026-11-20" });
  const oxygen = await receive(customer.id, [against(sent, "Medical oxygen", 3)], {
    date: "2026-11-15",
  });
  // Cancelled, so it stands in nothing's way.
  const wrong = await receive(customer.id, [against(sent, "Medical oxygen", 2)], {
    date: "2026-11-12",
  });
  await agency.cancel(wrong);
  const blocking = (...returns: { id: string; number: string }[]) =>
    returns.map(({ id, number }) => ({ id, number }));
  return { ...agency, sent: await viewBill(sent.id), argon, oxygen, blocking };
}

/** Asserts that the correction is refused, naming exactly these returns. */
async function expectBlocked(
  agency: Awaited<ReturnType<typeof sendAndReceive>>,
  change: object,
  message: string,
  returns: { id: string; number: string }[],
) {
  const { admin, sent, correctionFor, postCorrection, viewBill, blocking } = agency;

  const response = await postCorrection(sent, correctionFor(sent, change), admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toEqual(
    expect.objectContaining({ message, blockingBills: blocking(...returns) }),
  );
  expect(await viewBill(sent.id)).toEqual(sent);
}

test("the customer of a bill with returns cannot be changed", async () => {
  const agency = await sendAndReceive();
  const other = await agency.addParty("customer", "Lotus Clinic");

  await expectBlocked(
    agency,
    { customerId: other.id },
    "Bill 1234 has returns matched to it, so its customer cannot be changed. Cancel those returns first.",
    // The oldest first.
    [agency.oxygen, agency.argon],
  );
});

test.each([
  ["removed", [{ gas: "Medical oxygen", quantity: 5 }]],
  [
    "changed for another",
    [
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Nitrogen", quantity: 2 },
    ],
  ],
])("a gas with returns cannot be %s", async (_case, lines) => {
  const agency = await sendAndReceive();

  await expectBlocked(
    agency,
    { lines: agency.asLines(lines) },
    "Bill 1234 cannot have fewer than the 1 Argon returned against it. Cancel the returns in the way first, or change the correction.",
    [agency.argon],
  );
});

test("a gas cannot be lowered below what has been returned of it", async () => {
  const agency = await sendAndReceive();

  await expectBlocked(
    agency,
    {
      lines: agency.asLines([
        { gas: "Medical oxygen", quantity: 1 },
        { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
        { gas: "Argon", quantity: 2 },
      ]),
    },
    "Bill 1234 cannot have fewer than the 3 Medical oxygen returned against it. Cancel the returns in the way first, or change the correction.",
    [agency.oxygen],
  );
});

test.each([
  ["after every return", "2026-11-21", ["oxygen", "argon"]],
  ["after the first return", "2026-11-16", ["oxygen"]],
] as const)("a bill with returns cannot be dated %s", async (_case, date, names) => {
  const agency = await sendAndReceive();

  await expectBlocked(
    agency,
    { date },
    "Bill 1234 cannot be dated after cylinders were returned against it. Cancel the returns in the way first, or change the correction.",
    names.map((name) => agency[name]),
  );
});

test("a bill may be dated the day of its first return, or earlier", async () => {
  const { sent, correct, argon } = await sendAndReceive();
  expect(argon).toBeDefined();

  const later = await correct(sent, { date: "2026-11-15" });

  expect(later.date).toBe("2026-11-15");
  expect((await correct(later, { date: START_DATE })).date).toBe(START_DATE);
});

test("a refusal says everything in the way, and names each return once", async () => {
  const agency = await sendAndReceive();

  await expectBlocked(
    agency,
    { date: "2026-11-21", lines: agency.asLines([{ gas: "Medical oxygen", quantity: 1 }]) },
    "Bill 1234 cannot have fewer than the 3 Medical oxygen returned against it. " +
      "Bill 1234 cannot have fewer than the 1 Argon returned against it. " +
      "Bill 1234 cannot be dated after cylinders were returned against it. " +
      "Cancel the returns in the way first, or change the correction.",
    [agency.oxygen, agency.argon],
  );
});

test("opening stock with returns cannot be lowered below them", async () => {
  const agency = await start();
  const { admin, customer, enter, receive, against, asLines, correctionFor } = agency;
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 4 }]);
  const returned = await receive(customer.id, [against(opening, "Medical oxygen", 3)]);

  const response = await agency.postCorrection(
    opening,
    correctionFor(opening, { lines: asLines([{ gas: "Medical oxygen", quantity: 2 }]) }),
    admin,
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message:
      "Opening stock cannot have fewer than the 3 Medical oxygen returned against it. " +
      "Cancel the returns in the way first, or change the correction.",
    blockingBills: [{ id: returned.id, number: returned.number }],
  });
  const raised = await agency.correct(opening, {
    lines: asLines([{ gas: "Medical oxygen", quantity: 9 }]),
  });
  expect(raised.returns).toMatchObject({ sent: 9, returned: 3, pending: 6 });
  expect(ids(raised)).toEqual(ids(opening));
});

test("a return matched to a bill later stands in the way too", async () => {
  const agency = await start();
  const { admin, customer, receive, unmatchedRow, dispatch, against, match, asLines } = agency;
  const returned = await receive(customer.id, [], {
    unmatched: [unmatchedRow("Medical oxygen", 3)],
  });
  const missing = await dispatch(customer.id);
  await match(returned, against(missing, "Medical oxygen", 2));

  const response = await agency.postCorrection(
    missing,
    agency.correctionFor(missing, { lines: asLines([{ gas: "Argon", quantity: 5 }]) }),
    admin,
  );

  expect(response.json()).toMatchObject({ blockingBills: [{ id: returned.id }] });
});

test("once its returns are cancelled, a bill can be corrected in any way", async () => {
  const agency = await sendAndReceive();
  const { sent, cancel, correct, asLines, addParty, pending, argon, oxygen } = agency;
  const other = await addParty("customer", "Lotus Clinic");
  await cancel(argon);
  await cancel(oxygen);

  const corrected = await correct(sent, {
    customerId: other.id,
    date: "2026-11-25",
    lines: asLines([{ gas: "Nitrogen", quantity: 1 }]),
  });

  expect(corrected.to).toMatchObject({ id: other.id });
  expect(await pending(other.id)).toMatchObject([{ gas: { name: "Nitrogen" }, pending: 1 }]);
  expect(await pending(agency.customer.id)).toEqual([]);
});

test("whether someone may correct a bill is settled before what stands in the way", async () => {
  const agency = await sendAndReceive();
  const colleague = await agency.signIn({ displayName: "Meena Iyer" });

  const response = await agency.postCorrection(
    agency.sent,
    agency.correctionFor(agency.sent, { date: "2026-11-21" }),
    colleague,
  );

  expect(response.statusCode).toBe(403);
  expect(response.json()).not.toHaveProperty("blockingBills");
});

test("whether someone may correct a bill is settled before whether it can be corrected", async () => {
  const agency = await start();
  const { customer, dispatch, cancel, signIn, correctionFor, postCorrection } = agency;
  const colleague = await signIn({ displayName: "Meena Iyer" });
  const sent = await dispatch(customer.id);
  await cancel(sent);

  const response = await postCorrection(sent, correctionFor(sent, six(agency)), colleague);

  expect(response.statusCode).toBe(403);
});

test("a correction that changes nothing keeps no version", async () => {
  const agency = await sendAndReceive();
  const { sent, correct, enter, shop } = agency;
  const opening = await enter(shop.id, [
    { gas: "Argon", quantity: 2 },
    { gas: "Argon", quantity: 2 },
  ]);

  for (const bill of [sent, opening]) {
    expect(await correct(bill, {})).toEqual(bill);
  }
});

// Which of two saves at once gets there first is left to chance, so each pair is
// sent several times over, on a customer of its own each time.
const TIMES = 5;

test.each([
  ["lowers its quantity", () => ({ number: "L", lines: "fewer" })],
  ["moves its date", () => ({ date: "2026-11-27" })],
  ["changes its customer", () => ({ customerId: "other" })],
] as const)(
  "a correction that %s and a return against the bill sent at once cannot both succeed",
  async (_case, changeFor) => {
    const agency = await start();
    const { admin, addParty, dispatch, returnFor, postReturn, against, asLines } = agency;
    const other = await addParty("customer", "Lotus Clinic");
    for (let time = 0; time < TIMES; time += 1) {
      const { id } = await addParty("customer", `Clinic ${time}`);
      const sent = await dispatch(id);
      const change: Record<string, unknown> = { ...changeFor() };
      if (change.lines) {
        change.lines = asLines([{ gas: "Medical oxygen", quantity: 3 }]);
        change.number = `L${time}`;
      }
      if (change.customerId) {
        change.customerId = other.id;
      }
      const correction = agency.correctionFor(sent, change);
      const payload = returnFor(id, [against(sent, "Medical oxygen", 4)]);
      await agency.openConnections();

      const [corrected, returned] = await Promise.all([
        agency.postCorrection(sent, correction, admin),
        postReturn(payload),
      ]);

      // Either the correction went first and the return no longer fitted, or the
      // return did and the bill stayed as it was.
      const changed = corrected.statusCode === 200;
      expect([corrected.statusCode, returned.statusCode]).toEqual(
        changed ? [200, 409] : [409, 201],
      );
      const bill = await agency.viewBill(sent.id);
      expect(bill.returns?.returned).toBe(changed ? 0 : 4);
      expect(bill.returns?.pending).toBeGreaterThanOrEqual(0);
    }
  },
);

test("a correction and a match to the same bill sent at once cannot over-return it", async () => {
  const agency = await start();
  const { admin, addParty, dispatch, receive, unmatchedRow, against, asLines } = agency;
  for (let time = 0; time < TIMES; time += 1) {
    const { id } = await addParty("customer", `Clinic ${time}`);
    const returned = await receive(id, [], { unmatched: [unmatchedRow("Medical oxygen", 4)] });
    const sent = await dispatch(id);
    const correction = agency.correctionFor(sent, {
      lines: asLines([{ gas: "Medical oxygen", quantity: 3 }]),
    });
    await agency.openConnections();

    const [corrected, matched] = await Promise.all([
      agency.postCorrection(sent, correction, admin),
      agency.postMatch(returned, against(sent, "Medical oxygen", 4)),
    ]);

    expect([corrected.statusCode, matched.statusCode]).toEqual(
      corrected.statusCode === 200 ? [200, 409] : [409, 201],
    );
  }
});

test("two corrections that swap customers between two bills can be sent at once", async () => {
  const agency = await start();
  const { admin, addParty, dispatch, correctionFor, postCorrection } = agency;
  for (let time = 0; time < TIMES; time += 1) {
    const one = await addParty("customer", `Clinic ${time}`);
    const two = await addParty("customer", `Hospital ${time}`);
    const first = await dispatch(one.id);
    const second = await dispatch(two.id);
    await agency.openConnections();

    const responses = await Promise.all([
      postCorrection(first, correctionFor(first, { customerId: two.id }), admin),
      postCorrection(second, correctionFor(second, { customerId: one.id }), admin),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
  }
});
