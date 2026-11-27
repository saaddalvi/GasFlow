import type { StockCardQuery } from "@gasflow/shared";

/** The query string that asks for this card, on the web app and the API alike. */
export function stockCardSearch({ partyId, from, to, full }: StockCardQuery): string {
  const query = new URLSearchParams({ partyId });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (full) query.set("full", "true");
  return query.toString();
}
