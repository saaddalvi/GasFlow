import type { BillListQuery } from "@gasflow/shared";

/** The query string that asks for these bills, on the web app and the API alike. */
export function billListSearch({ pending, page, ...filters }: BillListQuery): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value) query.set(name, value);
  }
  if (pending) query.set("pending", "true");
  if (page > 1) query.set("page", String(page));
  return query.toString();
}
