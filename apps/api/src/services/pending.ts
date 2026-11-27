import type {
  Bill,
  BillReturns,
  ClearingType,
  ClosedRowList,
  ClosedRowListQuery,
  Split,
  SplitQuery,
  PendingList,
  PendingQuery,
  PendingReturnList,
  PendingReturnListQuery,
  PendingRow,
  ReturnCustomerList,
  ReturnCustomerListQuery,
  ReturnCounts,
  StockCardMatchedBill,
} from "@gasflow/shared";
import { daysBetween } from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database, Transaction } from "../database";
import { fromDatabaseDate } from "../database-date";
import { Prisma } from "../generated/prisma/client";
import { noSuchGas } from "./gases";
import { getOverdueLimit } from "./overdue-limit";
import { listParties, noSuchParty } from "./parties";

// What customers have yet to return. It is worked out from the posted bills and
// the allocations of posted returns and write-offs, and never stored. What came
// back beyond it is in unmatched.ts.

const PAGE_SIZE = 50;

/**
 * Each line that returns and write-offs can be matched to: those of posted
 * dispatch bills and of customers' opening stock, with how much of each posted
 * returns and write-offs have cleared, whatever their dates, and how much is
 * still pending.
 */
const CLEARABLE_LINES = Prisma.sql`
  SELECT l.id AS line_id, l.line_no, l.gas_id, l.quantity AS sent,
         b.id AS bill_id, b.to_party_id AS customer_id, p.name AS customer_name,
         p.active AS customer_active, b.type, b.paper_kind, b.number, b.date, b.entered_at,
         cleared.returned, cleared.written_off,
         l.quantity - cleared.returned - cleared.written_off AS pending
    FROM bills b
    JOIN parties p ON p.id = b.to_party_id AND p.type = 'customer'
    JOIN bill_lines l ON l.bill_id = b.id
   CROSS JOIN LATERAL (
     SELECT COALESCE(SUM(a.quantity) FILTER (WHERE cb.type = 'return_from_customer'), 0)::int
              AS returned,
            COALESCE(SUM(a.quantity) FILTER (WHERE cb.type = 'write_off'), 0)::int
              AS written_off
       FROM allocations a
       JOIN bill_lines cl ON cl.id = a.clearing_line_id
       JOIN bills cb ON cb.id = cl.bill_id
      WHERE a.cleared_line_id = l.id AND cb.status = 'posted'
   ) cleared
   WHERE b.status = 'posted' AND b.type IN ('dispatch', 'opening_stock')
`;

// The orders of bills. Opening stock is older than any dispatch.
const OLDEST_FIRST = Prisma.sql`c.date, c.type = 'opening_stock' DESC, c.entered_at, c.bill_id`;
const NEWEST_FIRST = Prisma.sql`c.date DESC, c.type = 'opening_stock', c.entered_at DESC, c.bill_id`;

export interface ClearableLine {
  lineId: string;
  billId: string;
  paperKind: PendingRow["bill"]["paperKind"];
  number: string;
  gasId: string;
  gasName: string;
  pending: number;
}

/**
 * The lines of these bills of the customer's, the oldest bill first and each
 * bill's lines in their order on it.
 */
export function findClearableLines(
  tx: Transaction,
  customerId: string,
  billIds: string[],
): Promise<ClearableLine[]> {
  return tx.$queryRaw<ClearableLine[]>`
    WITH lines AS (${CLEARABLE_LINES})
    SELECT c.line_id AS "lineId", c.bill_id AS "billId", c.paper_kind::text AS "paperKind",
           c.number::text AS number, c.gas_id AS "gasId", g.name::text AS "gasName",
           c.pending
      FROM lines c JOIN gases g ON g.id = c.gas_id
     WHERE c.customer_id = ${customerId}::uuid
       AND c.bill_id = ANY(${billIds}::uuid[])
     ORDER BY ${OLDEST_FIRST}, c.line_no
  `;
}

/** The part of a posted return or write-off that is matched to one line of a bill. */
export interface AllocationToBill {
  clearingLineId: string;
  clearedLineId: string;
  quantity: number;
  /** The gas of both lines. */
  gasId: string;
  gasName: string;
  clearingBillId: string;
  clearingType: ClearingType;
  clearingNumber: string;
  clearingDate: Date;
}

/**
 * What posted returns and write-offs have matched to the lines of the bill, the
 * oldest of those first.
 */
export function findAllocationsToBill(
  tx: Transaction,
  billId: string,
): Promise<AllocationToBill[]> {
  return tx.$queryRaw<AllocationToBill[]>`
    SELECT a.clearing_line_id AS "clearingLineId", a.cleared_line_id AS "clearedLineId",
           a.quantity, l.gas_id AS "gasId", g.name::text AS "gasName",
           cb.id AS "clearingBillId", cb.type::text AS "clearingType",
           cb.number::text AS "clearingNumber", cb.date AS "clearingDate"
      FROM allocations a
      JOIN bill_lines l ON l.id = a.cleared_line_id
      JOIN gases g ON g.id = l.gas_id
      JOIN bill_lines cl ON cl.id = a.clearing_line_id
      JOIN bills cb ON cb.id = cl.bill_id
     WHERE l.bill_id = ${billId}::uuid AND cb.status = 'posted'
     ORDER BY cb.date, cb.entered_at, cb.id, l.line_no
  `;
}

/** The cylinders of one gas on a return or write-off that are matched to one bill. */
export interface MatchMade {
  clearingBillId: string;
  gasId: string;
  /** The bill they are matched to, which is a dispatch bill or opening stock. */
  billId: string;
  type: StockCardMatchedBill["type"];
  paperKind: PendingRow["bill"]["paperKind"];
  number: string;
  quantity: number;
}

/**
 * What these returns and write-offs have matched of each gas to each bill, the
 * oldest of those bills first.
 */
export function findMatchesMadeBy(db: Database, clearingBillIds: string[]): Promise<MatchMade[]> {
  return db.$queryRaw<MatchMade[]>`
    SELECT cl.bill_id AS "clearingBillId", cl.gas_id AS "gasId", c.bill_id AS "billId",
           c.type::text AS type, c.paper_kind::text AS "paperKind", c.number::text AS number,
           SUM(a.quantity)::int AS quantity
      FROM allocations a
      JOIN bill_lines cl ON cl.id = a.clearing_line_id
      JOIN bill_lines l ON l.id = a.cleared_line_id
      JOIN (SELECT id AS bill_id, type, paper_kind, number, date, entered_at FROM bills) c
        ON c.bill_id = l.bill_id
     WHERE cl.bill_id = ANY(${clearingBillIds}::uuid[])
     GROUP BY cl.bill_id, cl.gas_id, c.bill_id, c.type, c.paper_kind, c.number, c.date,
              c.entered_at
     ORDER BY ${OLDEST_FIRST}
  `;
}

/**
 * The ids of the posted dispatch bills with cylinders pending. Each has at least
 * one cylinder out, so there are no more of them than there are such cylinders.
 */
export async function findPendingDispatchIds(db: Database): Promise<string[]> {
  const rows = await db.$queryRaw<{ billId: string }[]>`
    WITH lines AS (${CLEARABLE_LINES})
    SELECT DISTINCT bill_id AS "billId" FROM lines WHERE type = 'dispatch' AND pending > 0
  `;
  return rows.map((row) => row.billId);
}

/**
 * How much of each of these bills that is a posted dispatch has been returned and
 * written off, by the bill's id. Other bills are left out.
 */
export async function countDispatchReturns(
  db: Database,
  billIds: string[],
): Promise<Map<string, ReturnCounts>> {
  const rows = await db.$queryRaw<(ReturnCounts & { billId: string })[]>`
    WITH lines AS (${CLEARABLE_LINES})
    SELECT bill_id AS "billId", SUM(sent)::int AS sent, SUM(returned)::int AS returned,
           SUM(written_off)::int AS "writtenOff", SUM(pending)::int AS pending
      FROM lines
     WHERE type = 'dispatch' AND bill_id = ANY(${billIds}::uuid[])
     GROUP BY bill_id
  `;
  return new Map(rows.map(({ billId, ...counts }) => [billId, counts]));
}

/** What the customer can return or have written off cylinders against on the date. */
export async function listPending(
  db: Database,
  clock: Clock,
  { customerId, date }: PendingQuery,
): Promise<PendingList> {
  await refuseUnknownCustomer(db, customerId);
  const daysOutSince = await countingDaysOut(db, clock);
  const rows = await findPendingRows(db, customerId, date);
  return { rows: rows.map((row) => ({ ...row, ...daysOutSince(row.bill.date) })) };
}

/**
 * One page of the rows with cylinders pending, from the customer named or from any,
 * the longest out first.
 */
export async function listPendingReturns(
  db: Database,
  clock: Clock,
  { customerId, page }: PendingReturnListQuery,
): Promise<PendingReturnList> {
  const asked = customerId ? Prisma.sql`c.customer_id = ${customerId}::uuid` : Prisma.sql`TRUE`;
  const pending = pendingRowsWhere(asked);
  const daysOutSince = await countingDaysOut(db, clock);
  const { rows, total } = await pageOfRows(db, pending, OLDEST_FIRST, page);
  return {
    rows: rows.map((row) => {
      const { customerId: id, customerName: name, customerActive: active } = row;
      const pendingRow = asRow(row);
      return {
        ...pendingRow,
        customer: { id, name, active },
        ...daysOutSince(pendingRow.bill.date),
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * All the cylinders on the pending returns list together: how many there are,
 * how many customers have them and how many are overdue.
 */
export async function sumPendingReturns(db: Database, clock: Clock) {
  const daysOutSince = await countingDaysOut(db, clock);
  // Cylinders of one customer's dated one day are overdue or not together.
  const sums = await db.$queryRaw<{ customerId: string; date: Date; pending: number }[]>`
    SELECT r."customerId", r.date, SUM(r.pending)::int AS pending
      FROM (${pendingRowsWhere(Prisma.sql`TRUE`)}) r
     GROUP BY r."customerId", r.date
  `;
  const overdue = sums.filter(({ date }) => daysOutSince(fromDatabaseDate(date)).overdue);
  const total = (rows: typeof sums) => rows.reduce((sum, row) => sum + row.pending, 0);
  return {
    quantity: total(sums),
    customers: new Set(sums.map((row) => row.customerId)).size,
    overdue: total(overdue),
  };
}

/**
 * The rows, dated on or before the date, with cylinders of the customer's still
 * pending, the oldest first.
 */
export async function findPendingRows(
  db: Database | Transaction,
  customerId: string,
  date: string,
): Promise<PendingRow[]> {
  const rows = await db.$queryRaw<Row[]>`
    ${rowsOf(customerId, date)}
    HAVING SUM(c.pending) > 0
    ORDER BY ${OLDEST_FIRST}, MIN(c.line_no)
  `;
  return rows.map(asRow);
}

/**
 * How a total of one gas would fill what the customer has pending on the date,
 * the oldest bill first, and how much would be left over. It saves nothing.
 */
export async function proposeSplit(
  db: Database,
  clock: Clock,
  { customerId, date, gasId, total }: SplitQuery,
): Promise<Split> {
  const { rows } = await listPending(db, clock, { customerId, date });
  // A retired gas is still filled, as its cylinders can still come back.
  if (!(await db.gas.findUnique({ where: { id: gasId }, select: { id: true } }))) {
    throw noSuchGas();
  }
  let left = total;
  const filled: Split["rows"] = [];
  for (const { bill, gas, pending } of rows) {
    if (gas.id !== gasId || left === 0) continue;
    const quantity = Math.min(pending, left);
    filled.push({ billId: bill.id, quantity });
    left -= quantity;
  }
  return { rows: filled, excess: left };
}

/** One page of the customer's rows, dated on or before the date, with nothing pending. */
export async function listClosedRows(
  db: Database,
  { customerId, date, page }: ClosedRowListQuery,
): Promise<ClosedRowList> {
  await refuseUnknownCustomer(db, customerId);
  const closed = Prisma.sql`
    ${rowsOf(customerId, date)}
    HAVING SUM(c.pending) <= 0
  `;
  const { rows, total } = await pageOfRows(db, closed, NEWEST_FIRST, page);
  return { rows: rows.map(asRow), total, page, pageSize: PAGE_SIZE };
}

/** One page of the active customers by name, each with what they have pending. */
export async function listReturnCustomers(
  db: Database,
  query: ReturnCustomerListQuery,
): Promise<ReturnCustomerList> {
  const { parties, ...page } = await listParties(db, {
    ...query,
    type: "customer",
    inactive: false,
    holders: false,
  });
  const ids = parties.map((party) => party.id);
  const counts = await db.$queryRaw<{ customerId: string; pending: number }[]>`
    WITH lines AS (${CLEARABLE_LINES})
    SELECT customer_id AS "customerId", SUM(pending)::int AS pending
      FROM lines
     WHERE customer_id = ANY(${ids}::uuid[])
     GROUP BY customer_id
  `;
  const pending = new Map(counts.map((count) => [count.customerId, count.pending]));
  return {
    ...page,
    customers: parties.map(({ id, name, mobile }) => ({
      id,
      name,
      mobile,
      pending: pending.get(id) ?? 0,
    })),
  };
}

/**
 * What has come back or been written off against a posted dispatch bill or
 * customer's opening stock, or null for any other bill, on which nothing can be
 * pending.
 */
export async function getBillReturns(
  db: Database,
  {
    id: billId,
    type,
    status,
    toParty,
    lines,
  }: Pick<Bill, "id" | "type" | "status" | "lines"> & { toParty: { type: string } | null },
): Promise<BillReturns | null> {
  // The same bills as CLEARABLE_LINES.
  const sends = type === "dispatch" || type === "opening_stock";
  if (!sends || status !== "posted" || toParty?.type !== "customer") {
    return null;
  }
  const allocations = await db.allocation.findMany({
    where: { clearedLine: { billId }, clearingLine: { bill: { status: "posted" } } },
    select: {
      quantity: true,
      clearedLine: { select: { gas: { select: { id: true, name: true } } } },
      clearingLine: {
        select: {
          bill: {
            select: {
              id: true,
              type: true,
              number: true,
              date: true,
              enteredBy: { select: { id: true, displayName: true } },
            },
          },
        },
      },
    },
    // The oldest first, and each one's gases in their order on this bill.
    orderBy: [
      { clearingLine: { bill: { date: "asc" } } },
      { clearingLine: { bill: { enteredAt: "asc" } } },
      { clearingLine: { billId: "asc" } },
      { clearedLine: { lineNo: "asc" } },
    ],
  });
  const entries = new Map<string, BillReturns["entries"][number]>();
  for (const { quantity, clearedLine, clearingLine } of allocations) {
    const { date, type, ...bill } = clearingLine.bill;
    const entry = entries.get(bill.id) ?? {
      ...bill,
      // Nothing but a return or a write-off is matched to a bill.
      type: type as ClearingType,
      date: fromDatabaseDate(date),
      quantity: 0,
      gases: [],
    };
    entries.set(bill.id, entry);
    entry.quantity += quantity;
    addUp(entry.gases, [{ gas: clearedLine.gas, quantity }]);
  }
  const sent = addUp([], lines);
  /** The cylinders of each gas that entries of one type have cleared. */
  const clearedBy = (type: ClearingType) =>
    addUp(
      [],
      [...entries.values()].filter((entry) => entry.type === type).flatMap((entry) => entry.gases),
    );
  const returned = clearedBy("return_from_customer");
  const writtenOff = clearedBy("write_off");
  const gases = sent.map(({ gas, quantity }) => {
    const ofThis = (totals: Quantities) =>
      totals.find((other) => other.gas.id === gas.id)?.quantity ?? 0;
    const counts = { returned: ofThis(returned), writtenOff: ofThis(writtenOff) };
    return {
      gas,
      sent: quantity,
      ...counts,
      pending: quantity - counts.returned - counts.writtenOff,
    };
  });
  const total = (of: "sent" | "returned" | "writtenOff" | "pending") =>
    gases.reduce((sum, gas) => sum + gas[of], 0);
  return {
    sent: total("sent"),
    returned: total("returned"),
    writtenOff: total("writtenOff"),
    pending: total("pending"),
    status:
      total("pending") === 0
        ? "closed"
        : total("pending") === total("sent")
          ? "open"
          : "partly_returned",
    gases,
    entries: [...entries.values()],
  };
}

type Quantities = BillReturns["entries"][number]["gases"];

/** Adds the quantities to the totals, one for each gas, and gives the totals. */
function addUp(totals: Quantities, quantities: Quantities): Quantities {
  for (const { gas, quantity } of quantities) {
    const total = totals.find((other) => other.gas.id === gas.id);
    if (total) {
      total.quantity += quantity;
    } else {
      totals.push({ gas, quantity });
    }
  }
  return totals;
}

async function refuseUnknownCustomer(db: Database, customerId: string): Promise<void> {
  const customer = await db.party.findUnique({
    where: { id: customerId, type: "customer" },
    select: { id: true },
  });
  if (!customer) {
    throw noSuchParty();
  }
}

interface Row {
  billId: string;
  customerId: string;
  customerName: string;
  customerActive: boolean;
  type: PendingRow["bill"]["type"];
  paperKind: PendingRow["bill"]["paperKind"];
  number: string;
  date: Date;
  gasId: string;
  gasName: string;
  sent: number;
  returned: number;
  writtenOff: number;
  pending: number;
}

/**
 * A query for one row for each bill and gas among the lines that meet the
 * condition, for its caller to narrow and order.
 */
function rowsWhere(condition: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    WITH lines AS (${CLEARABLE_LINES})
    SELECT c.bill_id AS "billId", c.customer_id AS "customerId",
           c.customer_name::text AS "customerName", c.customer_active AS "customerActive",
           c.type::text AS type, c.paper_kind::text AS "paperKind",
           c.number::text AS number, c.date,
           c.gas_id AS "gasId", g.name::text AS "gasName",
           SUM(c.sent)::int AS sent, SUM(c.returned)::int AS returned,
           SUM(c.written_off)::int AS "writtenOff", SUM(c.pending)::int AS pending
      FROM lines c JOIN gases g ON g.id = c.gas_id
     WHERE ${condition}
     GROUP BY c.bill_id, c.customer_id, c.customer_name, c.customer_active, c.type, c.paper_kind,
              c.number, c.date, c.entered_at, c.gas_id, g.name
  `;
}

/** A query for the rows that meet the condition and have cylinders pending. */
function pendingRowsWhere(condition: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    ${rowsWhere(condition)}
    HAVING SUM(c.pending) > 0
  `;
}

/** The rows of the customer's bills dated on or before the date. */
function rowsOf(customerId: string, date: string): Prisma.Sql {
  return rowsWhere(Prisma.sql`c.customer_id = ${customerId}::uuid AND c.date <= ${date}::date`);
}

/** One page of the rows the query gives, in the order, and how many it gives in all. */
async function pageOfRows(
  db: Database,
  query: Prisma.Sql,
  order: Prisma.Sql,
  page: number,
): Promise<{ rows: Row[]; total: number }> {
  const [rows, [{ total }]] = await Promise.all([
    db.$queryRaw<Row[]>`
      ${query}
      ORDER BY ${order}, MIN(c.line_no)
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `,
    db.$queryRaw<[{ total: number }]>`
      SELECT COUNT(*)::int AS total FROM (${query}) AS counted
    `,
  ]);
  return { rows, total };
}

function asRow({
  billId,
  type,
  paperKind,
  number,
  date,
  gasId,
  gasName,
  sent,
  returned,
  writtenOff,
  pending,
}: Row): PendingRow {
  return {
    bill: { id: billId, type, paperKind, number, date: fromDatabaseDate(date) },
    gas: { id: gasId, name: gasName },
    sent,
    returned,
    writtenOff,
    pending,
  };
}

/**
 * Gives, for the date of a bill, how long cylinders pending on it have been out
 * as of today, and whether that is over the limit as it stands.
 */
async function countingDaysOut(db: Database, clock: Clock) {
  const limit = await getOverdueLimit(db);
  const now = today(clock);
  return (billDate: string) => {
    // A date that has not come yet is no days ago.
    const daysOut = Math.max(0, daysBetween(billDate, now));
    return { daysOut, overdue: daysOut > limit };
  };
}
