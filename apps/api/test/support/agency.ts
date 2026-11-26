import {
  billListSchema,
  billSchema,
  gasListSchema,
  partySchema,
  shopSchema,
  stockReportSchema,
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

  /** Saves a dispatch bill, expecting it to be saved. */
  async function dispatch(customerId: string, change?: object) {
    const response = await postBill(dispatchFor(customerId, change));
    expect(response.statusCode).toBe(201);
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
    report,
    figures,
    bills,
  };
}
