import type { BillListQuery } from "@gasflow/shared";

/** The query string that asks for these bills, on the web app and the API alike. */
export function billListSearch({ status, page }: BillListQuery): string {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  return query.toString();
}
