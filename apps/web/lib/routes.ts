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

/** Where cylinders coming back from a customer are recorded. */
export const RECEIVE_EMPTIES_PATH = "/returns/new";

/** Returned cylinders that have yet to be matched to a bill. */
export const UNMATCHED_RETURNS_PATH = "/returns/unmatched";

/** Where opening stock is entered and listed. */
export const OPENING_STOCK_PATH = "/bills/opening-stock/new";
