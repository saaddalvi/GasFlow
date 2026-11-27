import { queryDate, queryPage } from "@gasflow/shared";
import { partyPath } from "./routes";

/** Which of a party's bills to list. */
export const BILL_CHOICES = ["active", "cancelled", "all"] as const;

export type BillChoice = (typeof BILL_CHOICES)[number];

/** What a party's page shows, as its address says. */
export interface PartyPageQuery {
  /** The party's bills, or what was sent and returned day by day. */
  view: "bills" | "daily";
  bills: BillChoice;
  /** The first and last dates wanted, of the bills and the days alike. */
  from?: string;
  to?: string;
  /** The page of the bills or the days, whichever is shown. */
  page: number;
  pendingPage: number;
  unmatchedPage: number;
}

/** Reads the address. Whatever it asks that makes no sense is taken as not asked. */
export function readPartyPageQuery(
  params: Record<string, string | string[] | undefined>,
): PartyPageQuery {
  const date = (name: string) => queryDate.safeParse(params[name]).data;
  const page = (name: string) => queryPage.safeParse(params[name]).data ?? 1;
  return {
    view: params.view === "daily" ? "daily" : "bills",
    bills: BILL_CHOICES.find((choice) => choice === params.bills) ?? "active",
    from: date("from"),
    to: date("to"),
    page: page("page"),
    pendingPage: page("pendingPage"),
    unmatchedPage: page("unmatchedPage"),
  };
}

/** The address of the party's page showing this, scrolled to one of its sections. */
export function partyPageHref(
  partyId: string,
  { view, bills, from, to, page, pendingPage, unmatchedPage }: PartyPageQuery,
  section: "pending" | "unmatched" | "activity",
): string {
  const query = new URLSearchParams();
  if (view !== "bills") query.set("view", view);
  if (bills !== "active") query.set("bills", bills);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (page > 1) query.set("page", String(page));
  if (pendingPage > 1) query.set("pendingPage", String(pendingPage));
  if (unmatchedPage > 1) query.set("unmatchedPage", String(unmatchedPage));
  const search = query.toString();
  return `${partyPath(partyId)}${search && `?${search}`}#${section}`;
}
