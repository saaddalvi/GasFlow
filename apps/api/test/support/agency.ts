import {
  billSchema,
  gasListSchema,
  partySchema,
  shopSchema,
  type FillState,
  type PartyType,
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

  return { ...testApp, admin, staff, shop, get, gas, addParty, asLines, postOpeningStock, enter };
}
