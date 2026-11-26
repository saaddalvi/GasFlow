import {
  billListSchema,
  billSchema,
  closedRowListSchema,
  splitSchema,
  gasListSchema,
  matchedSchema,
  partySchema,
  pendingListSchema,
  receivedReturnSchema,
  returnCustomerListSchema,
  shopSchema,
  stockReportSchema,
  unmatchedListSchema,
  vehicleSchema,
  type FillState,
  type PartyType,
  type StockReportRow,
} from "@gasflow/shared";
import { expect } from "vitest";
import { startTestApp } from "./test-app";

export const START_DATE = "2026-11-01";

/** One line of opening stock, with the gas named rather than identified. */
export interface Line {
  gas: string;
  fillState?: FillState;
  quantity: number;
}

/**
 * The app set up as an agency would have it, with an admin and a staff member
 * signed in, and the start date set unless told otherwise. Everything is done
 * through the API, as the screens do it.
 */
export async function startAgency({ startDate = START_DATE }: { startDate?: string | null } = {}) {
  const testApp = await startTestApp();
  const { app } = testApp;
  const admin = await testApp.signIn({ displayName: "Asha Patil", isAdmin: true });
  const staff = await testApp.signIn({ displayName: "Ravi Shah" });

  const get = (url: string, { headers } = staff) => app.inject({ method: "GET", url, headers });

  if (startDate) {
    const response = await app.inject({
      method: "PUT",
      url: "/api/start-date",
      headers: admin.headers,
      payload: { date: startDate },
    });
    expect(response.statusCode).toBe(200);
  }

  const shop = shopSchema.parse((await get("/api/shop")).json());
  const { gases } = gasListSchema.parse((await get("/api/gases")).json());

  /** The starting gas with this name. */
  function gas(name: string) {
    const found = gases.find((candidate) => candidate.name === name);
    if (!found) {
      throw new Error(`No gas named ${name}`);
    }
    return found;
  }

  async function addParty(type: PartyType, name: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/parties",
      headers: staff.headers,
      payload: { type, name },
    });
    expect(response.statusCode).toBe(201);
    return partySchema.parse(response.json());
  }

  async function addVehicle(vehicle: { plate: string; label?: string; active?: boolean }) {
    const response = await app.inject({
      method: "POST",
      url: "/api/vehicles",
      headers: staff.headers,
      payload: vehicle,
    });
    expect(response.statusCode).toBe(201);
    return vehicleSchema.parse(response.json());
  }

  /** The lines as a request carries them. */
  const asLines = (lines: Line[]) =>
    lines.map(({ gas: name, fillState = "filled", quantity }) => ({
      gasId: gas(name).id,
      fillState,
      quantity,
    }));

  /** Asks to enter a party's opening stock, as the admin unless told otherwise. */
  const postOpeningStock = (payload: object, { headers } = admin) =>
    app.inject({ method: "POST", url: "/api/opening-stock", headers, payload });

  /** Enters a party's opening stock as the admin, expecting it to be saved. */
  async function enter(partyId: string, lines: Line[]) {
    const response = await postOpeningStock({ partyId, lines: asLines(lines) });
    expect(response.statusCode).toBe(201);
    return billSchema.parse(response.json());
  }

  /** Asks to save a bill, as the staff member unless told otherwise. */
  const postBill = (payload: object, { headers }: { headers: Record<string, string> } = staff) =>
    app.inject({ method: "POST", url: "/api/bills", headers, payload });

  let billsNumbered = 0;

  /**
   * What the new bill form sends for a dispatch, with a fresh bill number. A test
   * changes whatever matters to it.
   */
  function dispatchFor(customerId: string, change: object = {}) {
    billsNumbered += 1;
    return {
      type: "dispatch",
      paperKind: "bill",
      number: String(1000 + billsNumbered),
      date: "2026-11-26",
      customerId,
      lines: asLines([{ gas: "Medical oxygen", quantity: 5 }]),
      ...change,
    };
  }

  /** Saves a bill, expecting it to be saved. */
  async function save(payload: object) {
    const response = await postBill(payload);
    expect(response.statusCode).toBe(201);
    return billSchema.parse(response.json());
  }

  /** Saves a dispatch bill, expecting it to be saved. */
  const dispatch = (customerId: string, change?: object) => save(dispatchFor(customerId, change));

  /**
   * What the new bill form sends for a send to refiller, with a fresh bill number.
   * A test changes whatever matters to it.
   */
  function sendFor(refillerId: string, change: object = {}) {
    billsNumbered += 1;
    return {
      type: "send_to_refiller",
      paperKind: "bill",
      number: String(1000 + billsNumbered),
      date: "2026-11-26",
      refillerId,
      lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 5 }]),
      ...change,
    };
  }

  /** Saves a send to refiller, expecting it to be saved. */
  const send = (refillerId: string, change?: object) => save(sendFor(refillerId, change));

  /**
   * What the new bill form sends for a return from refiller, with a fresh slip
   * number. A test changes whatever matters to it.
   */
  function refillerReturnFor(refillerId: string, change: object = {}) {
    billsNumbered += 1;
    return {
      type: "return_from_refiller",
      number: String(1000 + billsNumbered),
      date: "2026-11-26",
      refillerId,
      lines: asLines([{ gas: "Medical oxygen", fillState: "filled", quantity: 5 }]),
      ...change,
    };
  }

  /** Saves a return from refiller, expecting it to be saved. */
  const refillerReturn = (refillerId: string, change?: object) =>
    save(refillerReturnFor(refillerId, change));

  /** One row of Receive empties as it is sent, against a gas on a bill. */
  const against = (
    bill: { id: string },
    name: string,
    quantity: number,
    change: { fillState?: FillState } = {},
  ) => ({ billId: bill.id, gasId: gas(name).id, quantity, ...change });

  /** One unmatched row of Receive empties as it is sent. */
  const unmatchedRow = (
    name: string,
    quantity: number,
    change: { fillState?: FillState } = {},
  ) => ({
    gasId: gas(name).id,
    quantity,
    ...change,
  });

  /** What Receive empties sends. A test changes whatever matters to it. */
  const returnFor = (customerId: string, allocations: object[], change: object = {}) => ({
    customerId,
    date: "2026-11-26",
    allocations,
    ...change,
  });

  /** Asks to save a return, as the staff member unless told otherwise. */
  const postReturn = (payload: object, { headers }: { headers: Record<string, string> } = staff) =>
    app.inject({ method: "POST", url: "/api/returns", headers, payload });

  /** Receives empties, expecting them to be saved. */
  async function receive(customerId: string, allocations: object[], change?: object) {
    const response = await postReturn(returnFor(customerId, allocations, change));
    expect(response.statusCode).toBe(201);
    return receivedReturnSchema.parse(response.json());
  }

  /** Asks to match unmatched cylinders on a return, as the staff member unless told otherwise. */
  const postMatch = (
    returned: { id: string },
    payload: object,
    { headers }: { headers: Record<string, string> } = staff,
  ) => app.inject({ method: "POST", url: `/api/returns/${returned.id}/matches`, headers, payload });

  /** Matches unmatched cylinders to a bill, expecting that to be saved. */
  async function match(returned: { id: string }, row: object) {
    const response = await postMatch(returned, row);
    expect(response.statusCode).toBe(201);
    return matchedSchema.parse(response.json());
  }

  /** What Receive empties lists for the customer on a date. */
  async function pending(customerId: string, date = "2026-11-26") {
    const response = await get(`/api/returns/pending?customerId=${customerId}&date=${date}`);
    expect(response.statusCode).toBe(200);
    return pendingListSchema.parse(response.json()).rows;
  }

  /** Asks how "Fill oldest first" would split a total of a gas, as the staff member unless told otherwise. */
  const askSplit = (
    customerId: string,
    gasId: string,
    total: number | string,
    {
      date = "2026-11-26",
      as = staff,
    }: { date?: string; as?: { headers: Record<string, string> } } = {},
  ) =>
    app.inject({
      method: "GET",
      url: `/api/returns/split?${new URLSearchParams({ customerId, date, gasId, total: String(total) }).toString()}`,
      headers: as.headers,
    });

  /** How "Fill oldest first" would split a total of the named gas, on a date. */
  async function split(customerId: string, name: string, total: number, date?: string) {
    const response = await askSplit(customerId, gas(name).id, total, { date });
    expect(response.statusCode).toBe(200);
    return splitSchema.parse(response.json());
  }

  /** One page of the rows with nothing pending, for a query such as "page=2". */
  async function closed(customerId: string, query = "", date = "2026-11-26") {
    const response = await get(
      `/api/returns/closed?customerId=${customerId}&date=${date}&${query}`,
    );
    expect(response.statusCode).toBe(200);
    return closedRowListSchema.parse(response.json());
  }

  /** What the Receive empties picker lists for a query such as "search=city". */
  async function returnCustomers(query = "") {
    const response = await get(`/api/returns/customers?${query}`);
    expect(response.statusCode).toBe(200);
    return returnCustomerListSchema.parse(response.json());
  }

  /** One page of the unmatched returns, for a query such as "page=2". */
  async function unmatchedList(query = "") {
    const response = await get(`/api/returns/unmatched?${query}`);
    expect(response.statusCode).toBe(200);
    return unmatchedListSchema.parse(response.json());
  }

  /** The bill as its page shows it. */
  async function viewBill(billId: string) {
    const response = await get(`/api/bills/${billId}`);
    expect(response.statusCode).toBe(200);
    return billSchema.parse(response.json());
  }

  /** The stock report staff see for a query such as "date=2026-11-01". */
  async function report(query = "") {
    const response = await get(`/api/reports/stock?${query}`);
    expect(response.statusCode).toBe(200);
    return stockReportSchema.parse(response.json());
  }

  /** The report's figures for one gas, or undefined if the report leaves it out. */
  async function figures(gas: string, query?: string) {
    const row = (await report(query)).rows.find((candidate) => candidate.gas.name === gas);
    if (!row) {
      return undefined;
    }
    const counts: Partial<StockReportRow> = { ...row };
    delete counts.gas;
    return counts;
  }

  /** One page of the bill list for a query such as "page=2". */
  async function bills(query = "") {
    const response = await get(`/api/bills?${query}`);
    expect(response.statusCode).toBe(200);
    return billListSchema.parse(response.json());
  }

  return {
    ...testApp,
    admin,
    staff,
    shop,
    get,
    gas,
    addParty,
    addVehicle,
    asLines,
    postOpeningStock,
    enter,
    postBill,
    dispatchFor,
    dispatch,
    sendFor,
    send,
    refillerReturnFor,
    refillerReturn,
    against,
    unmatchedRow,
    returnFor,
    postReturn,
    receive,
    postMatch,
    match,
    pending,
    askSplit,
    split,
    closed,
    returnCustomers,
    unmatchedList,
    viewBill,
    report,
    figures,
    bills,
  };
}
