import { auth } from "@clerk/nextjs/server";
import {
  balanceRegisterSchema,
  billListSchema,
  billNumberUseSchema,
  billSchema,
  closedRowListSchema,
  dailySummarySchema,
  dayLedgerSchema,
  splitSchema,
  gasListSchema,
  openingStockListSchema,
  openingStockPartiesSchema,
  overdueLimitSchema,
  partyHoldingSchema,
  partyListSchema,
  partyReportSchema,
  partySchema,
  pendingListSchema,
  pendingReturnListSchema,
  refusalSchema,
  returnCustomerListSchema,
  shopSchema,
  staffListSchema,
  staffSchema,
  startDateSchema,
  stockCardSchema,
  stockReportSchema,
  todaySchema,
  unmatchedListSchema,
  vehicleListSchema,
  type BalanceRegister,
  type BalanceRegisterQuery,
  type Bill,
  type BillList,
  type BillListQuery,
  type BillNumberUse,
  type BillNumberUseQuery,
  type BlockingBill,
  type ClosedRowList,
  type ClosedRowListQuery,
  type DailySummary,
  type DailySummaryQuery,
  type DayLedger,
  type DayLedgerQuery,
  type Split,
  type SplitQuery,
  type GasList,
  type OpeningStockList,
  type OpeningStockListQuery,
  type OpeningStockParties,
  type OverdueLimit,
  type Party,
  type PartyHolding,
  type PartyList,
  type PartyListQuery,
  type PartyReport,
  type PendingList,
  type PendingQuery,
  type PendingReturnList,
  type PendingReturnListQuery,
  type ReturnCustomerList,
  type ReturnCustomerListQuery,
  type Shop,
  type RefillerSlipNumberUseQuery,
  type Staff,
  type StaffList,
  type StartDate,
  type StockCard,
  type StockCardQuery,
  type StockReport,
  type StockReportQuery,
  type UnmatchedList,
  type UnmatchedListQuery,
  type VehicleList,
} from "@gasflow/shared";
import { refresh } from "next/cache";
import { balanceRegisterSearch } from "./balance-register-search";
import { billListSearch } from "./bill-list-search";
import { partyListSearch } from "./party-list-search";
import { stockCardSearch } from "./stock-card-search";

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

/** The parties asked for, with what each holds, and the figures for all of them. */
export async function fetchPartyReport(query: PartyListQuery): Promise<PartyReport> {
  return partyReportSchema.parse(await getJson(`/api/reports/parties?${partyListSearch(query)}`));
}

/** What the party holds now, and what has moved this month. */
export async function fetchPartyHolding(partyId: string): Promise<PartyHolding> {
  const path = `/api/parties/${encodeURIComponent(partyId)}/holding`;
  return partyHoldingSchema.parse(await getJson(path));
}

/** One page of the days cylinders were sent to the party or returned by it. */
export async function fetchDailySummary(
  partyId: string,
  { from = "", to = "", page }: DailySummaryQuery,
): Promise<DailySummary> {
  const query = new URLSearchParams({ from, to, page: String(page) });
  const path = `/api/parties/${encodeURIComponent(partyId)}/daily-summary?${query}`;
  return dailySummarySchema.parse(await getJson(path));
}

/** The bill, or undefined if there is none with this id. */
export async function fetchBill(billId: string): Promise<Bill | undefined> {
  const found = await findJson(`/api/bills/${encodeURIComponent(billId)}`);
  return found === undefined ? undefined : billSchema.parse(found);
}

export async function fetchBills(query: BillListQuery): Promise<BillList> {
  return billListSchema.parse(await getJson(`/api/bills?${billListSearch(query)}`));
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

/** The customers Receive empties offers, with what each has pending. */
export async function fetchReturnCustomers({
  search = "",
  page,
}: ReturnCustomerListQuery): Promise<ReturnCustomerList> {
  const query = new URLSearchParams({ search, page: String(page) });
  return returnCustomerListSchema.parse(await getJson(`/api/returns/customers?${query}`));
}

/** What the customer can return or have written off cylinders against on the date. */
export async function fetchPending(query: PendingQuery): Promise<PendingList> {
  return pendingListSchema.parse(
    await getJson(`/api/returns/pending?${new URLSearchParams(query).toString()}`),
  );
}

/** One page of what customers, or the one named, have yet to return. */
export async function fetchPendingReturns({
  customerId = "",
  page,
}: PendingReturnListQuery): Promise<PendingReturnList> {
  const query = new URLSearchParams({ customerId, page: String(page) });
  return pendingReturnListSchema.parse(await getJson(`/api/reports/pending-returns?${query}`));
}

/** The days out that cylinders must exceed to be overdue. */
export async function fetchOverdueLimit(): Promise<OverdueLimit> {
  return overdueLimitSchema.parse(await getJson("/api/overdue-limit"));
}

/** How "Fill oldest first" would split a total of a gas. It saves nothing. */
export async function fetchSplit({ total, ...query }: SplitQuery): Promise<Split> {
  const search = new URLSearchParams({ ...query, total: String(total) });
  return splitSchema.parse(await getJson(`/api/returns/split?${search.toString()}`));
}

/** One page of the customer's rows with nothing pending. */
export async function fetchClosedRows({
  page,
  ...query
}: ClosedRowListQuery): Promise<ClosedRowList> {
  const search = new URLSearchParams({ ...query, page: String(page) });
  return closedRowListSchema.parse(await getJson(`/api/returns/closed?${search}`));
}

/** One page of the unmatched returns, from every customer or the one named. */
export async function fetchUnmatched({
  customerId = "",
  page,
}: UnmatchedListQuery): Promise<UnmatchedList> {
  const query = new URLSearchParams({ customerId, page: String(page) });
  return unmatchedListSchema.parse(await getJson(`/api/returns/unmatched?${query}`));
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

/** The day ledger for the date, or for today if none is given. */
export async function fetchDayLedger({ date }: DayLedgerQuery): Promise<DayLedger> {
  const query = new URLSearchParams(date ? { date } : {});
  return dayLedgerSchema.parse(await getJson(`/api/reports/ledger?${query}`));
}

/** What customers and refillers held on the date asked for, or today if none is given. */
export async function fetchBalanceRegister(query: BalanceRegisterQuery): Promise<BalanceRegister> {
  const path = `/api/reports/party-balance?${balanceRegisterSearch(query)}`;
  return balanceRegisterSchema.parse(await getJson(path));
}

/** The stock card asked for, or why the API will not give it. */
export async function fetchStockCard(
  query: StockCardQuery,
): Promise<{ card: StockCard; refusal?: never } | { card?: never; refusal: string }> {
  const path = `/api/reports/holdings?${stockCardSearch(query)}`;
  const response = await askApi(path);
  // A refusal says why, in words for the person.
  if (response.status >= 400 && response.status < 500) {
    return { refusal: refusalSchema.parse(await response.json()).message };
  }
  return { card: stockCardSchema.parse(await readJson(response, path)) };
}

/** The API's own answer to a request for the card as a file, to pass on. */
export function fetchStockCardCsv(query: StockCardQuery): Promise<Response> {
  return askApi(`/api/reports/holdings.csv?${stockCardSearch(query)}`);
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
  /** The bills that stand in the way, when that is why it was not made. */
  blockingBills?: BlockingBill[];
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
      const { message, blockingBills } = refusalSchema.parse(await response.json());
      return { error: message, blockingBills };
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
