import type { BalanceRegisterQuery } from "@gasflow/shared";

/** The query string that asks for this register, on the web app and the API alike. */
export function balanceRegisterSearch({
  date,
  type,
  show,
  search,
  page,
}: BalanceRegisterQuery): string {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (type) query.set("type", type);
  if (show !== "non_zero") query.set("show", show);
  if (search) query.set("search", search);
  if (page > 1) query.set("page", String(page));
  return query.toString();
}
