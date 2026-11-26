import type { UnmatchedList, UnmatchedListQuery } from "@gasflow/shared";
import type { Database, Transaction } from "../database";
import { fromDatabaseDate } from "../database-date";
import { Prisma } from "../generated/prisma/client";
import { Refusal } from "../refusal";

// Cylinders that came back beyond everything pending, and have yet to be matched
// to a bill. They are what the lines of posted returns hold beyond their
// allocations, and are never stored apart from those.

const PAGE_SIZE = 50;

/** Each line of a posted return, with how much of it no allocation covers. */
const RETURN_LINES = Prisma.sql`
  SELECT l.id AS line_id, l.line_no, l.gas_id,
         b.id AS return_id, b.from_party_id AS customer_id, b.number, b.date, b.entered_at,
         l.quantity - COALESCE((
           SELECT SUM(a.quantity) FROM allocations a WHERE a.clearing_line_id = l.id
         ), 0)::int AS unmatched
    FROM bills b
    JOIN bill_lines l ON l.bill_id = b.id
   WHERE b.status = 'posted' AND b.type = 'return_from_customer'
`;

/** The lines of a posted return that have cylinders of the gas unmatched, in their order on it. */
export function findUnmatchedLines(
  tx: Transaction,
  returnId: string,
  gasId: string,
): Promise<{ lineId: string; unmatched: number }[]> {
  return tx.$queryRaw<{ lineId: string; unmatched: number }[]>`
    WITH lines AS (${RETURN_LINES})
    SELECT line_id AS "lineId", unmatched
      FROM lines
     WHERE return_id = ${returnId}::uuid AND gas_id = ${gasId}::uuid AND unmatched > 0
     ORDER BY line_no
  `;
}

export function noSuchReturn(): Refusal {
  return new Refusal(404, "There is no such return.");
}

/** One page of the unmatched cylinders of each return and gas, the oldest return first. */
export async function listUnmatched(
  db: Database,
  { page }: UnmatchedListQuery,
): Promise<UnmatchedList> {
  const unmatched = Prisma.sql`
    WITH lines AS (${RETURN_LINES})
    SELECT r.return_id AS "returnId", r.number::text AS number, r.date,
           p.id AS "customerId", p.name::text AS "customerName",
           g.id AS "gasId", g.name::text AS "gasName",
           SUM(r.unmatched)::int AS quantity
      FROM lines r
      JOIN parties p ON p.id = r.customer_id
      JOIN gases g ON g.id = r.gas_id
     GROUP BY r.return_id, r.number, r.date, r.entered_at, p.id, p.name, g.id, g.name
    HAVING SUM(r.unmatched) > 0
  `;
  const [rows, [{ total }]] = await Promise.all([
    db.$queryRaw<Row[]>`
      ${unmatched}
      ORDER BY r.date, r.entered_at, r.return_id, MIN(r.line_no)
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `,
    db.$queryRaw<[{ total: number }]>`
      SELECT COUNT(*)::int AS total FROM (${unmatched}) AS unmatched
    `,
  ]);
  return {
    rows: rows.map((row) => ({
      return: { id: row.returnId, number: row.number, date: fromDatabaseDate(row.date) },
      customer: { id: row.customerId, name: row.customerName },
      gas: { id: row.gasId, name: row.gasName },
      quantity: row.quantity,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

interface Row {
  returnId: string;
  number: string;
  date: Date;
  customerId: string;
  customerName: string;
  gasId: string;
  gasName: string;
  quantity: number;
}
