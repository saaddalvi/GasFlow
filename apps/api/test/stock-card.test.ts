import { balanceRegisterSchema, stockCardSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { START_DATE, startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India, and the records
// begin on 1 November unless a test sets them earlier.

/** The agency, with the means to read a stock card as its screen does. */
async function start(options?: Parameters<typeof startAgency>[0]) {
  const agency = await startAgency(options);
  const { get, gas } = agency;

  /** The card of a party, for the rest of a query such as "from=2026-11-05". */
  async function card(party: { id: string }, query = "") {
    const response = await get(`/api/reports/holdings?partyId=${party.id}&${query}`);
    expect(response.statusCode).toBe(200);
    return stockCardSchema.parse(response.json());
  }

  /** The same card as a file. */
  const csv = (party: { id: string }, query = "") =>
    get(`/api/reports/holdings.csv?partyId=${party.id}&${query}`);

  /** One gas's figures over a stretch of a card. Whatever is not given is nothing. */
  const figures = (
    name: string,
    {
      sent = 0,
      returned = 0,
      writtenOff = 0,
      holding = 0,
    }: { sent?: number; returned?: number; writtenOff?: number; holding?: number },
  ) => ({ gas: { id: gas(name).id, name }, sent, returned, writtenOff, holding });

  return { ...agency, card, csv, figures };
}

test("the card opens with opening stock, then sums up each month by gas", async () => {
  const agency = await start({ startDate: "2026-09-01" });
  const { addParty, enter, dispatch, receive, against, asLines, card, figures, held } = agency;
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Argon", quantity: 4 }]);
  const first = await dispatch(customer.id, {
    date: "2026-09-10",
    lines: asLines([{ gas: "Medical oxygen", quantity: 5 }]),
  });
  await receive(customer.id, [against(first, "Medical oxygen", 3)], { date: "2026-09-20" });
  await dispatch(customer.id, {
    date: "2026-11-05",
    lines: asLines([{ gas: "Argon", quantity: 2 }]),
  });

  expect(await card(customer)).toMatchObject({
    party: { id: customer.id, type: "customer", name: "City Hospital", active: true },
    startDate: "2026-09-01",
    from: "2026-09-01",
    to: "2026-11-26",
    // In the order of the gases.
    gases: [{ name: "Medical oxygen" }, { name: "Argon" }],
    opening: [held("Medical oxygen", 0), held("Argon", 4)],
    months: [
      {
        month: "2026-09",
        gases: [
          figures("Medical oxygen", { sent: 5, returned: 3, holding: 2 }),
          figures("Argon", { holding: 4 }),
        ],
      },
      // Nothing moved, which is also worth saying.
      {
        month: "2026-10",
        gases: [figures("Medical oxygen", { holding: 2 }), figures("Argon", { holding: 4 })],
      },
      {
        month: "2026-11",
        gases: [
          figures("Medical oxygen", { holding: 2 }),
          figures("Argon", { sent: 2, holding: 6 }),
        ],
      },
    ],
    closing: [
      figures("Medical oxygen", { sent: 5, returned: 3, holding: 2 }),
      figures("Argon", { sent: 2, holding: 6 }),
    ],
  });
});

test("the opening row holds what moved before the range, and only the range is summed", async () => {
  const { addParty, enter, dispatch, receive, against, card, figures, held } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Medical oxygen", quantity: 4 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-05" });
  await receive(customer.id, [against(sent, "Medical oxygen", 2)], { date: "2026-11-10" });
  await dispatch(customer.id, { date: "2026-11-20" });

  expect(await card(customer, "from=2026-11-10&to=2026-11-19")).toMatchObject({
    from: "2026-11-10",
    to: "2026-11-19",
    opening: [held("Medical oxygen", 9)],
    months: [{ month: "2026-11", gases: [figures("Medical oxygen", { returned: 2, holding: 7 })] }],
    closing: [figures("Medical oxygen", { returned: 2, holding: 7 })],
  });
});

test("opening stock is the starting position even on the start date, never dispatched", async () => {
  const { addParty, enter, card, figures, held } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Argon", quantity: 4 }]);

  expect(await card(customer, `from=${START_DATE}&to=${START_DATE}`)).toMatchObject({
    opening: [held("Argon", 4)],
    months: [{ month: "2026-11", bills: [] }],
    closing: [figures("Argon", { holding: 4 })],
  });
});

test.each([
  ["on 26 November 2026", "2026-11-26T06:30:00.000Z", "2026-04-01", "2026-11-26"],
  ["on 31 March, late in the day", "2027-03-31T18:29:00.000Z", "2026-04-01", "2027-03-31"],
  ["as 1 April begins in India", "2027-03-31T18:30:00.000Z", "2027-04-01", "2027-04-01"],
])("%s, the range is the financial year so far", async (_when, now, from, to) => {
  const { addParty, card, clock } = await start({ startDate: "2025-06-15" });
  const customer = await addParty("customer", "City Hospital");
  clock.set(now);

  expect(await card(customer)).toMatchObject({ from, to });
});

test("a last date alone gives its own financial year up to it", async () => {
  const { addParty, card } = await start({ startDate: "2025-06-15" });
  const customer = await addParty("customer", "City Hospital");

  expect(await card(customer, "to=2026-03-31")).toMatchObject({
    // The records begin after that year did.
    from: "2025-06-15",
    to: "2026-03-31",
  });
});

test("full history runs from the start date, whatever first date is asked for", async () => {
  const { addParty, dispatch, card, figures } = await start({ startDate: "2025-06-15" });
  const customer = await addParty("customer", "City Hospital");
  await dispatch(customer.id, { date: "2025-07-01" });
  await dispatch(customer.id, { date: "2026-05-01" });

  expect(await card(customer)).toMatchObject({ from: "2026-04-01" });
  const whole = await card(customer, "full=true&from=2026-05-02");
  expect(whole).toMatchObject({
    from: "2025-06-15",
    to: "2026-11-26",
    closing: [figures("Medical oxygen", { sent: 10, holding: 10 })],
  });
  // From June 2025 to November 2026.
  expect(whole.months).toHaveLength(18);
  expect(whole.months.flatMap((month) => (month.bills.length > 0 ? [month.month] : []))).toEqual([
    "2025-07",
    "2026-05",
  ]);
});

test("every month of the range has a row, from the first to the last, across a year", async () => {
  const { addParty, card, clock } = await start({ startDate: "2025-06-15" });
  const customer = await addParty("customer", "City Hospital");
  clock.set("2027-02-10T06:30:00.000Z");

  const { months } = await card(customer, "from=2026-11-30&to=2027-02-01");

  expect(months.map((month) => month.month)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
});

test("a month that has not come has a row only if bills are dated up to it", async () => {
  const { addParty, dispatch, card } = await start();
  const customer = await addParty("customer", "City Hospital");
  const monthsTo = async (to: string) =>
    (await card(customer, `from=${START_DATE}&to=${to}`)).months.map((month) => month.month);

  expect(await monthsTo("9999-12-31")).toEqual(["2026-11"]);

  await dispatch(customer.id, { date: "2027-01-05" });

  expect(await monthsTo("9999-12-31")).toEqual(["2026-11", "2026-12", "2027-01"]);
  // The January bill is outside this range.
  expect(await monthsTo("2026-12-31")).toEqual(["2026-11"]);
});

test("a first date before the start date begins with the records", async () => {
  const { addParty, card } = await start();
  const customer = await addParty("customer", "City Hospital");

  expect(await card(customer, "from=2026-01-01")).toMatchObject({ from: START_DATE });
});

test("a range that ends before the start date has nothing on it", async () => {
  const { addParty, enter, card } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Argon", quantity: 4 }]);

  expect(await card(customer, "to=2026-10-31")).toMatchObject({
    startDate: START_DATE,
    from: "2026-04-01",
    to: "2026-10-31",
    gases: [],
    opening: [],
    months: [],
    closing: [],
  });
});

test("until a start date is set there is nothing on a card", async () => {
  const { addParty, card } = await start({ startDate: null });
  const customer = await addParty("customer", "City Hospital");

  expect(await card(customer)).toMatchObject({ startDate: null, gases: [], months: [] });
});

test("a gas is left off once nothing of it is held or moves in the range", async () => {
  const { addParty, dispatch, receive, against, asLines, card } = await start();
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id, {
    date: "2026-11-05",
    lines: asLines([{ gas: "Argon", quantity: 2 }]),
  });
  await receive(customer.id, [against(sent, "Argon", 2)], { date: "2026-11-06" });

  expect(await card(customer, "from=2026-11-06")).toMatchObject({ gases: [{ name: "Argon" }] });
  expect(await card(customer, "from=2026-11-07")).toMatchObject({ gases: [], opening: [] });
});

test.each([
  ["from=2026-11-10&to=2026-11-09", "The first date cannot be after the last."],
  ["from=2026-11-27", "The first date cannot be after the last."],
  ["from=yesterday", "Choose a date."],
])("the range %s is refused", async (query, message) => {
  const { addParty, get } = await start();
  const customer = await addParty("customer", "City Hospital");

  const response = await get(`/api/reports/holdings?partyId=${customer.id}&${query}`);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});

test("each month lists its bills, the oldest first, with the cylinders of each gas", async () => {
  const { addParty, enter, dispatch, receive, against, asLines, card, gas } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(customer.id, [{ gas: "Argon", quantity: 1 }]);
  const later = await dispatch(customer.id, {
    date: "2026-11-08",
    // Two fill states of one gas, which a card adds together.
    lines: asLines([
      { gas: "Argon", quantity: 2 },
      { gas: "Medical oxygen", quantity: 3 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  const back = await receive(customer.id, [against(later, "Argon", 1)], { date: "2026-11-09" });
  const earlier = await dispatch(customer.id, { date: "2026-11-05" });

  const [month] = (await card(customer)).months;

  const named = (name: string) => ({ id: gas(name).id, name });
  // Opening stock is where the card starts from, not one of its bills.
  expect(month!.bills).toMatchObject([
    { id: earlier.id, type: "dispatch", paperKind: "bill", number: earlier.number },
    {
      id: later.id,
      date: "2026-11-08",
      gases: [
        { gas: named("Medical oxygen"), quantity: 4, against: [], unmatched: 0 },
        { gas: named("Argon"), quantity: 2, against: [], unmatched: 0 },
      ],
    },
    { id: back.id, type: "return_from_customer", paperKind: null, number: back.number },
  ]);
});

test("a return says which bills it was against, and what of it is unmatched", async () => {
  const agency = await start();
  const { addParty, enter, dispatch, receive, against, unmatchedRow, card, figures } = agency;
  const customer = await addParty("customer", "City Hospital");
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 2 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-05", paperKind: "cash_memo" });
  await receive(
    customer.id,
    [
      against(sent, "Medical oxygen", 5),
      // Another fill state, matched to the same bill as any other.
      against(opening, "Medical oxygen", 1, { fillState: "filled" }),
      against(opening, "Medical oxygen", 1),
    ],
    { date: "2026-11-10", unmatched: [unmatchedRow("Medical oxygen", 3)] },
  );

  const { months, closing } = await card(customer);

  expect(months[0]!.bills[1]!.gases).toMatchObject([
    {
      quantity: 10,
      // Opening stock first, being the oldest.
      against: [
        {
          bill: { id: opening.id, type: "opening_stock", paperKind: null, number: opening.number },
          quantity: 2,
        },
        {
          bill: { id: sent.id, type: "dispatch", paperKind: "cash_memo", number: sent.number },
          quantity: 5,
        },
      ],
      unmatched: 3,
    },
  ]);
  expect(closing).toEqual([figures("Medical oxygen", { sent: 5, returned: 10, holding: -3 })]);
});

test("matching an unmatched return later shows on the card, even for a bill outside it", async () => {
  const { addParty, dispatch, receive, unmatchedRow, match, gas, card } = await start();
  const customer = await addParty("customer", "City Hospital");
  const back = await receive(customer.id, [], {
    date: "2026-11-10",
    unmatched: [unmatchedRow("Medical oxygen", 3)],
  });
  const found = await dispatch(customer.id, { date: "2026-11-05" });
  await match(back, { billId: found.id, gasId: gas("Medical oxygen").id, quantity: 2 });

  const { months } = await card(customer, "from=2026-11-06");

  expect(months[0]!.bills).toMatchObject([
    {
      id: back.id,
      gases: [{ quantity: 3, against: [{ bill: { id: found.id }, quantity: 2 }], unmatched: 1 }],
    },
  ]);
});

test("a write-off is counted apart from returns, and says which bill it was against", async () => {
  const agency = await start();
  const { addParty, dispatch, receive, against, customerWriteOff, card, figures } = agency;
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id, { date: "2026-11-05" });
  await receive(customer.id, [against(sent, "Medical oxygen", 2)], { date: "2026-11-08" });
  const lost = await customerWriteOff(customer.id, sent, "Medical oxygen", 1, {
    date: "2026-11-09",
  });

  const { months, closing } = await card(customer);

  expect(months[0]!.bills[2]).toMatchObject({
    id: lost.id,
    type: "write_off",
    writeOffReason: "lost",
    gases: [{ quantity: 1, against: [{ bill: { id: sent.id }, quantity: 1 }], unmatched: 0 }],
  });
  expect(closing).toEqual([
    figures("Medical oxygen", { sent: 5, returned: 2, writtenOff: 1, holding: 2 }),
  ]);
});

test("cancelled bills are left off, with whatever they were matched to", async () => {
  const { addParty, dispatch, receive, against, viewBill, cancel, card } = await start();
  const customer = await addParty("customer", "City Hospital");
  const sent = await dispatch(customer.id, { date: "2026-11-05" });
  const back = await receive(customer.id, [against(sent, "Medical oxygen", 2)], {
    date: "2026-11-08",
  });
  await cancel(await viewBill(back.id));
  await cancel(await dispatch(customer.id, { date: "2026-11-06" }));

  const { months } = await card(customer);

  expect(months[0]!.bills.map((bill) => bill.id)).toEqual([sent.id]);
  expect(months[0]!.gases).toMatchObject([{ sent: 5, returned: 0, holding: 5 }]);
});

test("a refiller's card counts sends, returns and write-offs, with nothing matched", async () => {
  const agency = await start();
  const { addParty, enter, send, refillerReturn, asLines, postBill, writeOffFor, admin } = agency;
  const { card, figures, held } = agency;
  const refiller = await addParty("refiller", "Deccan Gases");
  await enter(refiller.id, [{ gas: "Medical oxygen", quantity: 3 }]);
  await send(refiller.id, { date: "2026-11-12" });
  await refillerReturn(refiller.id, {
    date: "2026-11-15",
    lines: asLines([{ gas: "Medical oxygen", quantity: 4 }]),
  });
  const written = await postBill(
    writeOffFor({
      refillerId: refiller.id,
      date: "2026-11-18",
      lines: asLines([{ gas: "Medical oxygen", fillState: "defective", quantity: 1 }]),
    }),
    admin,
  );
  expect(written.statusCode).toBe(201);

  const read = await card(refiller);

  expect(read).toMatchObject({
    party: { type: "refiller" },
    opening: [held("Medical oxygen", 3)],
    closing: [figures("Medical oxygen", { sent: 5, returned: 4, writtenOff: 1, holding: 3 })],
  });
  expect(read.months[0]!.bills.flatMap((bill) => bill.gases)).toMatchObject([
    { quantity: 5, against: [], unmatched: 0 },
    { quantity: 4, against: [], unmatched: 0 },
    { quantity: 1, against: [], unmatched: 0 },
  ]);
});

test("a card holds only its own party's bills", async () => {
  const { addParty, dispatch, card } = await start();
  const customer = await addParty("customer", "City Hospital");
  const other = await addParty("customer", "Lotus Clinic");
  const sent = await dispatch(customer.id, { date: "2026-11-05" });
  await dispatch(other.id, { date: "2026-11-05" });

  expect((await card(customer)).months[0]!.bills.map((bill) => bill.id)).toEqual([sent.id]);
});

test("the closing holding matches the balance register for the last date", async () => {
  const agency = await start();
  const { addParty, enter, dispatch, send, receive, against, unmatchedRow } = agency;
  const { customerWriteOff, card, get } = agency;
  const hospital = await addParty("customer", "City Hospital");
  const deccan = await addParty("refiller", "Deccan Gases");
  await enter(hospital.id, [{ gas: "Argon", quantity: 4 }]);
  const sent = await dispatch(hospital.id, { date: "2026-11-05" });
  await receive(hospital.id, [against(sent, "Medical oxygen", 2)], { date: "2026-11-08" });
  await customerWriteOff(hospital.id, sent, "Medical oxygen", 1, { date: "2026-11-09" });
  await receive(hospital.id, [], { date: "2026-11-10", unmatched: [unmatchedRow("Nitrogen", 3)] });
  await send(deccan.id, { date: "2026-11-12" });

  for (const date of ["2026-11-01", "2026-11-07", "2026-11-09", "2026-11-11", "2026-11-26"]) {
    const response = await get(`/api/reports/party-balance?date=${date}&show=all`);
    const { parties } = balanceRegisterSchema.parse(response.json());
    for (const party of parties) {
      // From the records' start, and from part of the way through them.
      for (const query of [`to=${date}`, `from=${date}&to=${date}`]) {
        const { closing } = await card(party, query);
        // The register lists only the gases held.
        const holding = closing
          .filter((figures) => figures.holding !== 0)
          .map(({ gas, holding: quantity }) => ({ gas, quantity }));
        expect(holding, `${party.name}, ${query}`).toEqual(party.gases);
      }
    }
  }
});

test("a supplier, which holds no cylinders, has no card", async () => {
  const { addParty, get } = await start();
  const supplier = await addParty("supplier", "Sharp Cylinders");

  const response = await get(`/api/reports/holdings?partyId=${supplier.id}`);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "A supplier holds no cylinders, so it has no stock card.",
  });
});

test("the shop has no card, and nor does a party there is none of", async () => {
  const { shop, get } = await start();

  for (const id of [shop.id, "00000000-0000-4000-8000-000000000000"]) {
    const response = await get(`/api/reports/holdings?partyId=${id}`);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such party." });
  }
});

test("a card is asked for one party", async () => {
  const { get } = await start();

  const response = await get("/api/reports/holdings");

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Choose a customer or refiller." });
});

test("a signed-out request for a card is refused", async () => {
  const { addParty, app } = await start();
  const customer = await addParty("customer", "City Hospital");

  const response = await app.inject({
    method: "GET",
    url: `/api/reports/holdings?partyId=${customer.id}`,
  });

  expect(response.statusCode).toBe(401);
});

test("the card downloads as CSV with the figures the screen shows", async () => {
  const agency = await start();
  const { addParty, enter, dispatch, receive, against, unmatchedRow, customerWriteOff } = agency;
  const { csv } = agency;
  const customer = await addParty("customer", "City Hospital");
  const opening = await enter(customer.id, [{ gas: "Medical oxygen", quantity: 2 }]);
  const sent = await dispatch(customer.id, { date: "2026-11-05" });
  const back = await receive(
    customer.id,
    [against(opening, "Medical oxygen", 2), against(sent, "Medical oxygen", 5)],
    { date: "2026-11-10", unmatched: [unmatchedRow("Medical oxygen", 1)] },
  );
  const again = await dispatch(customer.id, { date: "2026-11-12", paperKind: "cash_memo" });
  const lost = await customerWriteOff(customer.id, again, "Medical oxygen", 2, {
    date: "2026-11-20",
  });

  const response = await csv(customer);

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
  expect(response.headers["content-disposition"]).toBe(
    'attachment; filename="stock-card-city-hospital-2026-11-01-to-2026-11-26.csv"',
  );
  // The mark at the start tells a spreadsheet that the text is UTF-8.
  expect(response.body).toBe(
    "\uFEFF" +
      [
        "Shop,GasFlow",
        "Stock card,City Hospital",
        "Type,Customer",
        "From,2026-11-01",
        "To,2026-11-26",
        "",
        "Row,Date,Bill type,Bill,Gas,Dispatched,Received back,Written off,Holding,Against",
        "Opening,2026-11-01,,,Medical oxygen,,,,2,",
        `Bill,2026-11-05,Dispatch,Bill ${sent.number},Medical oxygen,5,,,,`,
        `Bill,2026-11-10,Return,${back.number},Medical oxygen,,8,,,` +
          `2 against Opening stock; 5 against Bill ${sent.number}; 1 unmatched`,
        `Bill,2026-11-12,Dispatch,Cash memo ${again.number},Medical oxygen,5,,,,`,
        `Bill,2026-11-20,Write-off (Lost),${lost.number},Medical oxygen,,,2,,` +
          `2 against Cash memo ${again.number}`,
        "Month,2026-11,,,Medical oxygen,10,8,2,2,",
        "Closing,2026-11-26,,,Medical oxygen,10,8,2,2,",
      ]
        .map((row) => `${row}\r\n`)
        .join(""),
  );
});

test("the CSV covers the dates asked for, and calls a refiller's cylinders sent", async () => {
  const { addParty, send, csv } = await start();
  const refiller = await addParty("refiller", "Deccan Gases");
  await send(refiller.id, { date: "2026-11-12" });

  const { body, headers } = await csv(refiller, "from=2026-11-10&to=2026-11-15");

  expect(headers["content-disposition"]).toContain("deccan-gases-2026-11-10-to-2026-11-15.csv");
  expect(body).toContain("Type,Refiller\r\nFrom,2026-11-10\r\nTo,2026-11-15\r\n");
  expect(body).toContain("Row,Date,Bill type,Bill,Gas,Sent,Received back,");
  expect(body).toContain(",Send to refiller,");
});

test("the CSV keeps typed text in its own cell, and never as a formula", async () => {
  const { addParty, dispatch, enter, csv } = await start();
  const customer = await addParty("customer", '=SUM(A1), "The Clinic"');
  await enter(customer.id, [{ gas: "Argon", quantity: 1 }]);
  await dispatch(customer.id, { number: 'A,"7"' });
  const marathi = await addParty("customer", "रुग्णालय");

  const { body } = await csv(customer);

  expect(body).toContain('Stock card,"\'=SUM(A1), ""The Clinic"""\r\n');
  expect(body).toContain(',"Bill A,""7""",');
  const named = await csv(marathi);
  expect(named.body).toContain("Stock card,रुग्णालय\r\n");
  // A name with no letters a file name can safely hold is left out of it.
  expect(named.headers["content-disposition"]).toBe(
    'attachment; filename="stock-card-2026-11-01-to-2026-11-26.csv"',
  );
});

test("a CSV of a holding below zero keeps it a number", async () => {
  const { addParty, receive, unmatchedRow, csv } = await start();
  const customer = await addParty("customer", "City Hospital");
  await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 3)] });

  expect((await csv(customer)).body).toContain("Closing,2026-11-26,,,Argon,0,3,0,-3,\r\n");
});

test("the CSV is refused as the card is", async () => {
  const { addParty, csv } = await start();
  const supplier = await addParty("supplier", "Sharp Cylinders");

  const response = await csv(supplier);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "A supplier holds no cylinders, so it has no stock card.",
  });
});
