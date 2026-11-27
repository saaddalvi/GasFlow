import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

test("the list shows each bill's number, date, type, from and to, lines and status", async () => {
  const { shop, addParty, enter, dispatch, asLines, bills } = await startAgency();
  const customer = await addParty("customer", "City Hospital");
  const opening = await enter(shop.id, [{ gas: "Argon", fillState: "empty", quantity: 4 }]);
  const sent = await dispatch(customer.id, {
    paperKind: "cash_memo",
    number: "77",
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      { gas: "Argon", fillState: "empty", quantity: 2 },
    ]),
  });

  expect(await bills()).toEqual({
    bills: [
      {
        id: sent.id,
        type: "dispatch",
        paperKind: "cash_memo",
        number: "77",
        date: "2026-11-26",
        status: "posted",
        from: sent.from,
        to: sent.to,
        writeOffReason: null,
        lines: sent.lines,
        returns: { sent: 7, returned: 0, writtenOff: 0, pending: 7 },
      },
      {
        id: opening.id,
        type: "opening_stock",
        paperKind: null,
        number: opening.number,
        date: START_DATE,
        status: "posted",
        from: null,
        to: opening.to,
        writeOffReason: null,
        lines: opening.lines,
        returns: null,
      },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  });
});

test("the newest bills come first: by date, then by when they were entered", async () => {
  const { clock, addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  await dispatch(id, { number: "first entered", date: "2026-11-20" });
  clock.set("2026-11-26T07:00:00.000Z");
  await dispatch(id, { number: "oldest date", date: "2026-11-05" });
  clock.set("2026-11-26T08:00:00.000Z");
  await dispatch(id, { number: "last entered", date: "2026-11-20" });
  await dispatch(id, { number: "newest date", date: "2026-11-25" });

  expect((await bills()).bills.map((bill) => bill.number)).toEqual([
    "newest date",
    "last entered",
    "first entered",
    "oldest date",
  ]);
});

test("the list comes a page at a time", async () => {
  const { addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  for (let day = 1; day <= 26; day += 1) {
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    await dispatch(id, { number: `${day}a`, date });
    if (day < 26) {
      await dispatch(id, { number: `${day}b`, date });
    }
  }

  const first = await bills();
  const second = await bills("page=2");

  expect(first.bills).toHaveLength(50);
  expect(second).toMatchObject({ total: 51, page: 2, pageSize: 50 });
  expect(second.bills.map((bill) => bill.date)).toEqual(["2026-11-01"]);
});

test.each(["0", "-1", "two", "1.5"])("there is no page %s", async (page) => {
  const { get } = await startAgency();

  const response = await get(`/api/bills?page=${page}`);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "There is no such page." });
});

test("the list shows cylinders added and written off, with who is on each side", async () => {
  const { admin, shop, addParty, addCylindersFor, writeOffFor, postBill, bills } =
    await startAgency();
  const supplier = await addParty("supplier", "Sharp Cylinders");
  await postBill(addCylindersFor({ date: "2026-11-20" }), admin);
  await postBill(addCylindersFor({ date: "2026-11-21", supplierId: supplier.id }), admin);
  await postBill(writeOffFor({ writeOffReason: "lost" }), admin);

  expect((await bills()).bills).toMatchObject([
    {
      type: "write_off",
      number: "WOF-20261126-001",
      from: { id: shop.id },
      to: null,
      writeOffReason: "lost",
    },
    {
      type: "add_cylinders",
      number: "ADD-20261121-001",
      from: { id: supplier.id, type: "supplier" },
      to: { id: shop.id },
      writeOffReason: null,
    },
    { type: "add_cylinders", number: "ADD-20261120-001", from: null, to: { id: shop.id } },
  ]);
});

test("staff find bills by part of the bill number, in any capitals", async () => {
  const { addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  await dispatch(id, { number: "A-120", date: "2026-11-20" });
  await dispatch(id, { number: "A-12", date: "2026-11-21" });
  await dispatch(id, { number: "B-77", date: "2026-11-22" });

  const found = await bills("number=a-12");

  expect(found.bills.map((bill) => bill.number)).toEqual(["A-12", "A-120"]);
  expect(found.total).toBe(2);
});

test("staff find returns by part of the slip number, in any capitals", async () => {
  const { addParty, dispatch, receive, against, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  const sent = await dispatch(id, { number: "SL-4" });
  const slipped = await receive(id, [against(sent, "Medical oxygen", 1)], { slipNumber: "SL-45" });
  await receive(id, [against(sent, "Medical oxygen", 1)], { slipNumber: "SL-78" });
  await receive(id, [against(sent, "Medical oxygen", 1)]);

  const found = await bills("slipNumber=sl-4");

  expect(found.bills.map((bill) => bill.number)).toEqual([slipped.number]);
  expect(found.total).toBe(1);
});

test("staff narrow the list to one paper kind", async () => {
  const { addParty, dispatch, send, enter, bills } = await startAgency();
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Sharp Gases");
  await enter(customer.id, [{ gas: "Argon", quantity: 1 }]);
  await dispatch(customer.id, { paperKind: "bill", number: "1", date: "2026-11-20" });
  await dispatch(customer.id, { paperKind: "cash_memo", number: "2", date: "2026-11-21" });
  await send(refiller.id, { paperKind: "cash_memo", number: "3", date: "2026-11-22" });

  const found = await bills("paperKind=cash_memo");

  expect(found.bills.map((bill) => bill.number)).toEqual(["3", "2"]);
  expect(found.total).toBe(2);
});

test("staff narrow the list to one type of bill", async () => {
  const { addParty, dispatch, send, bills } = await startAgency();
  const customer = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Sharp Gases");
  await dispatch(customer.id, { number: "1" });
  await send(refiller.id, { number: "2" });

  const found = await bills("type=send_to_refiller");

  expect(found.bills.map((bill) => bill.number)).toEqual(["2"]);
  expect(found.total).toBe(1);
});

test("staff find a party's bills by part of its name, whichever side it is on", async () => {
  const { addParty, dispatch, send, refillerReturn, bills } = await startAgency();
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Lake Clinic");
  const refiller = await addParty("refiller", "Intercity Gases");
  await dispatch(hospital.id, { number: "to the hospital", date: "2026-11-20" });
  await dispatch(clinic.id, { number: "to the clinic", date: "2026-11-21" });
  await send(refiller.id, { number: "to the refiller", date: "2026-11-22" });
  await refillerReturn(refiller.id, { number: "from the refiller", date: "2026-11-23" });

  const found = await bills("party=cITY");

  expect(found.bills.map((bill) => bill.number)).toEqual([
    "from the refiller",
    "to the refiller",
    "to the hospital",
  ]);
  expect(found.total).toBe(3);
});

test("the shop's name finds no bills, though the shop is on nearly all of them", async () => {
  const { shop, addParty, enter, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Argon", quantity: 1 }]);
  await dispatch(id);

  expect(await bills(`party=${encodeURIComponent(shop.name)}`)).toMatchObject({
    bills: [],
    total: 0,
  });
});

test.each(["%", "_", "\\"])("a %s typed in a search stands only for itself", async (typed) => {
  const { addParty, dispatch, bills } = await startAgency();
  const odd = await addParty("customer", `Odd ${typed} Clinic`);
  const plain = await addParty("customer", "City Hospital");
  await dispatch(odd.id, { number: `7${typed}1` });
  await dispatch(plain.id, { number: "701" });
  const search = encodeURIComponent(typed);

  expect((await bills(`party=${search}`)).total).toBe(1);
  expect((await bills(`number=${search}`)).total).toBe(1);
});

test("staff narrow the list to a range of dates, which includes both ends", async () => {
  const { addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  for (const day of ["09", "10", "11", "12", "13"]) {
    await dispatch(id, { number: day, date: `2026-11-${day}` });
  }
  const numbers = async (query: string) => (await bills(query)).bills.map((bill) => bill.number);

  expect(await numbers("from=2026-11-10&to=2026-11-12")).toEqual(["12", "11", "10"]);
  expect(await numbers("from=2026-11-12")).toEqual(["13", "12"]);
  expect(await numbers("to=2026-11-10")).toEqual(["10", "09"]);
  expect(await numbers("from=2026-11-11&to=2026-11-11")).toEqual(["11"]);
  expect(await numbers("from=2026-11-12&to=2026-11-10")).toEqual([]);
});

test.each(["from=yesterday", "to=2026-02-30", "from=0000-01-01"])(
  "a date range such as %s is refused",
  async (query) => {
    const { get } = await startAgency();

    const response = await get(`/api/bills?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Choose a date." });
  },
);

test("filters apply together, and the total counts the matches on every page", async () => {
  const { addParty, dispatch, cancel, bills } = await startAgency();
  const hospital = await addParty("customer", "City Hospital");
  const clinic = await addParty("customer", "Lake Clinic");
  for (let count = 1; count <= 51; count += 1) {
    await dispatch(hospital.id, { number: `HA-${count}`, date: "2026-11-20" });
  }
  // Each of these misses one of the things asked for.
  await dispatch(clinic.id, { number: "HA-other party", date: "2026-11-20" });
  await dispatch(hospital.id, { number: "HA-other date", date: "2026-11-21" });
  await dispatch(hospital.id, { number: "HB-other number", date: "2026-11-20" });
  await dispatch(hospital.id, { number: "HA-memo", date: "2026-11-20", paperKind: "cash_memo" });
  await cancel(await dispatch(hospital.id, { number: "HA-cancelled", date: "2026-11-20" }));
  const asked =
    "number=ha-&party=city&from=2026-11-20&to=2026-11-20&type=dispatch&paperKind=bill&status=posted";

  const first = await bills(asked);
  const second = await bills(`${asked}&page=2`);

  expect(first.total).toBe(51);
  expect(first.bills).toHaveLength(50);
  expect(second).toMatchObject({ total: 51, page: 2 });
  expect(second.bills).toHaveLength(1);
});

test("filters left blank narrow nothing", async () => {
  const { addParty, dispatch, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  await dispatch(id);

  const blank = "number=&slipNumber=+&paperKind=&type=&party=&from=&to=&status=&pending=";

  expect((await bills(blank)).total).toBe(1);
});

test("bills sharing a number are told apart by type, date and party", async () => {
  const { addParty, dispatch, refillerReturn, bills } = await startAgency();
  const customer = await addParty("customer", "City Hospital");
  const sharp = await addParty("refiller", "Sharp Gases");
  const lake = await addParty("refiller", "Lake Gases");
  await dispatch(customer.id, { number: "88", paperKind: "bill", date: "2026-11-20" });
  await dispatch(customer.id, { number: "88", paperKind: "cash_memo", date: "2026-11-21" });
  await refillerReturn(sharp.id, { number: "88", date: "2026-11-22" });
  await refillerReturn(lake.id, { number: "88", date: "2026-11-23" });

  expect(await bills("number=88")).toMatchObject({
    bills: [
      { type: "return_from_refiller", date: "2026-11-23", from: { name: "Lake Gases" } },
      { type: "return_from_refiller", date: "2026-11-22", from: { name: "Sharp Gases" } },
      { type: "dispatch", paperKind: "cash_memo", date: "2026-11-21", to: { id: customer.id } },
      { type: "dispatch", paperKind: "bill", date: "2026-11-20", to: { id: customer.id } },
    ],
    total: 4,
  });
});

test("each dispatch bill shows how much has been returned and written off", async () => {
  const { addParty, dispatch, receive, against, customerWriteOff, cancel, asLines, bills } =
    await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  const sent = await dispatch(id, {
    lines: asLines([
      { gas: "Medical oxygen", quantity: 3 },
      { gas: "Argon", quantity: 2 },
    ]),
  });
  await receive(id, [against(sent, "Medical oxygen", 2), against(sent, "Argon", 1)]);
  await customerWriteOff(id, sent, "Medical oxygen", 1);
  const mistake = await receive(id, [against(sent, "Argon", 1)]);
  await cancel(mistake);

  const found = await bills("type=dispatch");

  expect(found.bills).toMatchObject([
    { id: sent.id, returns: { sent: 5, returned: 3, writtenOff: 1, pending: 1 } },
  ]);
});

test("only posted dispatch bills show how much has been returned", async () => {
  const { addParty, enter, dispatch, cancel, bills } = await startAgency();
  const { id } = await addParty("customer", "City Hospital");
  await enter(id, [{ gas: "Argon", quantity: 4 }]);
  await cancel(await dispatch(id, { date: "2026-11-20" }));
  await dispatch(id, { date: "2026-11-21" });

  expect((await bills()).bills).toMatchObject([
    { type: "dispatch", status: "posted", returns: { sent: 5, returned: 0, pending: 5 } },
    { type: "dispatch", status: "cancelled", returns: null },
    { type: "opening_stock", returns: null },
  ]);
});

/** Dispatches in every state of return, beside other bills with cylinders out. */
async function startWithReturns() {
  const agency = await startAgency();
  const { addParty, enter, dispatch, send, receive, against, customerWriteOff, cancel } = agency;
  const { id } = await addParty("customer", "City Hospital");
  const refiller = await addParty("refiller", "Sharp Gases");
  // Neither of these is a dispatch, though cylinders are out on them too.
  await enter(id, [{ gas: "Medical oxygen", quantity: 4 }]);
  await send(refiller.id);
  const dispatchOn = (number: string, day: string) =>
    dispatch(id, { number, date: `2026-11-${day}` });

  await dispatchOn("open", "20");
  const part = await dispatchOn("partly returned", "21");
  await receive(id, [against(part, "Medical oxygen", 3)]);
  const returned = await dispatchOn("all returned", "22");
  await receive(id, [against(returned, "Medical oxygen", 5)]);
  const gone = await dispatchOn("returned and written off", "23");
  await receive(id, [against(gone, "Medical oxygen", 3)]);
  await customerWriteOff(id, gone, "Medical oxygen", 2);
  const reopened = await dispatchOn("return cancelled", "24");
  await cancel(await receive(id, [against(reopened, "Medical oxygen", 5)]));
  await cancel(await dispatchOn("cancelled", "25"));

  return { ...agency, customer: { id }, part };
}

test("the pending returns filter shows only dispatch bills with cylinders pending", async () => {
  const { bills } = await startWithReturns();

  const found = await bills("pending=true");

  expect(found.bills.map((bill) => bill.number)).toEqual([
    "return cancelled",
    "partly returned",
    "open",
  ]);
  expect(found.total).toBe(3);
});

test("the pending returns filter applies together with the others", async () => {
  const { bills } = await startWithReturns();

  expect((await bills("pending=true&from=2026-11-21&to=2026-11-23")).bills).toMatchObject([
    { number: "partly returned", returns: { sent: 5, returned: 3, pending: 2 } },
  ]);
  expect((await bills("pending=true&number=returned&party=city")).total).toBe(1);
  expect((await bills("pending=true&type=opening_stock")).total).toBe(0);
  expect((await bills("pending=true&status=cancelled")).total).toBe(0);
});

test("a bill leaves the pending returns filter once everything on it is back", async () => {
  const { customer, part, receive, against, bills } = await startWithReturns();

  await receive(customer.id, [against(part, "Medical oxygen", 2)]);

  expect((await bills("pending=true&number=partly")).total).toBe(0);
});

test("the pending returns filter is on or off", async () => {
  const { get, bills } = await startWithReturns();

  expect((await bills("pending=false")).total).toBe((await bills()).total);
  const response = await get("/api/bills?pending=some");
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Use true or false." });
});
