import type { PartyListQuery } from "@gasflow/shared";

/** The query string that asks for these parties, on the web app and the API alike. */
export function partyListSearch({ search, type, inactive, page }: PartyListQuery): string {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (type) query.set("type", type);
  if (inactive) query.set("inactive", "true");
  if (page > 1) query.set("page", String(page));
  return query.toString();
}
