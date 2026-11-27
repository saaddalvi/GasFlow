/** The one page open to someone who is not signed in. */
export const SIGN_IN_PATH = "/sign-in";

/** Every bill, a page at a time. */
export const BILLS_PATH = "/bills";

/** Where a bill is entered: one copied from paper or, by an admin, one that is not. */
export const NEW_BILL_PATH = "/bills/new";

/** The page of one bill. */
export function billPath(billId: string): string {
  return `${BILLS_PATH}/${billId}`;
}

/** Where a posted bill is corrected. */
export function correctBillPath(billId: string): string {
  return `${billPath(billId)}/correct`;
}

/** Customers, refillers and suppliers. */
export const PARTIES_PATH = "/parties";

/** The page of one party. */
export function partyPath(partyId: string): string {
  return `${PARTIES_PATH}/${encodeURIComponent(partyId)}`;
}

/** Where cylinders coming back from a customer are recorded. */
export const RECEIVE_EMPTIES_PATH = "/returns/new";

/** Receive empties with this customer already chosen. */
export function receiveEmptiesFromPath(customerId: string): string {
  return `${RECEIVE_EMPTIES_PATH}?${new URLSearchParams({ customerId }).toString()}`;
}

/** What customers have yet to return, the longest out first. */
export const PENDING_RETURNS_PATH = "/returns/pending";

/** Returned cylinders that have yet to be matched to a bill. */
export const UNMATCHED_RETURNS_PATH = "/returns/unmatched";

/** Where opening stock is entered and listed. */
export const OPENING_STOCK_PATH = "/bills/opening-stock/new";

/** Where the cylinders were on a day. */
export const STOCK_REPORT_PATH = "/reports/stock";

/** What came into the shop and went out of it on a day. */
export const DAY_LEDGER_PATH = "/reports/ledger";
