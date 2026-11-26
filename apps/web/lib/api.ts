import { auth } from "@clerk/nextjs/server";
import {
  billListSchema,
  billNumberUseSchema,
  billSchema,
  gasListSchema,
  openingStockListSchema,
  openingStockPartiesSchema,
  partyListSchema,
  partySchema,
  refusalSchema,
  shopSchema,
  staffListSchema,
  staffSchema,
  startDateSchema,
  stockReportSchema,
  todaySchema,
  vehicleListSchema,
  type Bill,
  type BillList,
  type BillListQuery,
  type BillNumberUse,
  type BillNumberUseQuery,
  type GasList,
  type OpeningStockList,
  type OpeningStockListQuery,
  type OpeningStockParties,
  type Party,
  type PartyList,
  type PartyListQuery,
  type Shop,
  type RefillerSlipNumberUseQuery,
  type Staff,
  type StaffList,
  type StartDate,
  type StockReport,
  type StockReportQuery,
  type VehicleList,
} from "@gasflow/shared";
import { refresh } from "next/cache";
import { partyListSearch } from "./party-list-search";

// Everything here runs on the web server, never in the browser, and asks the API
// on behalf of the signed-in staff member.

/** The gases in use, and the retired ones too if asked for. */
export async function fetchGases({ retired = false } = {}): Promise<GasList> {
  return gasListSchema.parse(await getJson(`/api/gases?retired=${retired}`));
}

export async function fetchParties(query: PartyListQuery): Promise<PartyList> {
  return partyListSchema.parse(await getJson(`/api/parties?${partyListSearch(query)}`));
}

/** The party, or undefined if there is none with this id. */
export async function fetchParty(partyId: string): Promise<Party | undefined> {
  const found = await findJson(`/api/parties/${encodeURIComponent(partyId)}`);
  return found === undefined ? undefined : partySchema.parse(found);
}

/** The bill, or undefined if there is none with this id. */
export async function fetchBill(billId: string): Promise<Bill | undefined> {
  const found = await findJson(`/api/bills/${encodeURIComponent(billId)}`);
  return found === undefined ? undefined : billSchema.parse(found);
}

export async function fetchBills({ page }: BillListQuery): Promise<BillList> {
  return billListSchema.parse(await getJson(`/api/bills?page=${page}`));
}

/** Which bill, if any, already has this number on this paper kind. */
export async function fetchNumberUse(query: BillNumberUseQuery): Promise<BillNumberUse> {
  return billNumberUseSchema.parse(
    await getJson(`/api/bills/number-use?${new URLSearchParams(query).toString()}`),
  );
}

/** Which return from the refiller, if any, already has this slip number. */
export async function fetchRefillerSlipNumberUse(
  query: RefillerSlipNumberUseQuery,
): Promise<BillNumberUse> {
  return billNumberUseSchema.parse(
    await getJson(`/api/bills/refiller-slip-number-use?${new URLSearchParams(query).toString()}`),
  );
}

export async function fetchStartDate(): Promise<StartDate> {
  return startDateSchema.parse(await getJson("/api/start-date"));
}

export async function fetchOpeningStock({
  page,
}: OpeningStockListQuery): Promise<OpeningStockList> {
  return openingStockListSchema.parse(await getJson(`/api/opening-stock?page=${page}`));
}

/** The parties whose opening stock can still be entered. Only for admins. */
export async function fetchOpeningStockParties(): Promise<OpeningStockParties> {
  return openingStockPartiesSchema.parse(await getJson("/api/opening-stock/parties"));
}

/** The stock report for the date, or for today if none is given. */
export async function fetchStockReport({ date }: StockReportQuery): Promise<StockReport> {
  const query = new URLSearchParams(date ? { date } : {});
  return stockReportSchema.parse(await getJson(`/api/reports/stock?${query}`));
}

/** Today's date in India. */
export async function fetchToday(): Promise<string> {
  return todaySchema.parse(await getJson("/api/today")).date;
}

/** The vehicles in use, and the inactive ones too if asked for. */
export async function fetchVehicles({ inactive = false } = {}): Promise<VehicleList> {
  return vehicleListSchema.parse(await getJson(`/api/vehicles?inactive=${inactive}`));
}

export async function fetchShop(): Promise<Shop> {
  return shopSchema.parse(await getJson("/api/shop"));
}

export async function fetchMe(): Promise<Staff> {
  return staffSchema.parse(await getJson("/api/me"));
}

export async function fetchStaff(): Promise<StaffList> {
  return staffListSchema.parse(await getJson("/api/staff"));
}

/** How a change went: why it was not made, or where to go now that it is. */
export interface Outcome {
  error?: string;
  goTo?: string;
}

/**
 * Asks the API to change something, for a Server Function to answer with. The
 * page is then loaded again, because even after a refusal it may be out of date.
 */
export async function sendChange(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  /** Makes the outcome from what the API answered, once the change is made. */
  whenMade: (answer: Response) => Promise<Outcome> = () => Promise.resolve({}),
): Promise<Outcome> {
  const outcome = await askForChange(method, path, body, whenMade);
  refresh();
  return outcome;
}

async function askForChange(
  method: string,
  path: string,
  body: unknown,
  whenMade: (answer: Response) => Promise<Outcome>,
): Promise<Outcome> {
  try {
    const response = await askApi(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.ok) {
      return await whenMade(response);
    }
    // A refusal says why, in words for the person. A server error does not.
    if (response.status < 500) {
      return { error: refusalSchema.parse(await response.json()).message };
    }
    console.error(`The API answered ${response.status} for ${method} ${path}.`);
  } catch (error) {
    console.error(error);
  }
  return { error: "Something went wrong. Check whether the change was made, then try again." };
}

/** The answer, or null with the reason logged, for a page to show its own message. */
export function orNull<T>(answer: Promise<T>): Promise<T | null> {
  return answer.catch((error: unknown) => {
    console.error(error);
    return null;
  });
}

async function getJson(path: string): Promise<unknown> {
  return readJson(await askApi(path), path);
}

/** What is at the path, or undefined if there is nothing there. */
async function findJson(path: string): Promise<unknown> {
  const response = await askApi(path);
  return response.status === 404 ? undefined : readJson(response, path);
}

async function readJson(response: Response, path: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path}.`);
  }
  return response.json();
}

async function askApi(
  path: string,
  { headers, ...init }: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const baseUrl = process.env.API_URL;
  if (!baseUrl) {
    throw new Error("API_URL is not set. See .env.example.");
  }
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error(`No one is signed in to ask the API for ${path}.`);
  }
  return fetch(new URL(path, baseUrl), {
    ...init,
    cache: "no-store",
    headers: { ...headers, authorization: `Bearer ${token}` },
  });
}
