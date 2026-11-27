import {
  addDays,
  countAtShop,
  firstOfMonth,
  type BillType,
  type Dashboard,
  type GasHeld,
  type StockReportRow,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database } from "../database";
import { fromDatabaseDate } from "../database-date";
import { Prisma } from "../generated/prisma/client";
import { enteredDuring } from "./bills";
import { countOutsideShop, heldBy } from "./holdings";
import { sumPendingReturns } from "./pending";
import { reportStock } from "./stock-report";

/**
 * Today's activity and where the cylinders are, worked out from the posted bills.
 * No count is stored anywhere.
 */
export async function reportDashboard(db: Database, clock: Clock): Promise<Dashboard> {
  const date = today(clock);
  const monthStart = firstOfMonth(date);
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = firstOfMonth(lastMonthEnd);
  const [activity, customers, billsEntered, stock, outside, pendingReturns] = await Promise.all([
    // Everything compared falls between the first of last month and today.
    findActivity(db, lastMonthStart, date),
    countCustomersSentTo(db, date),
    countBillsEntered(db, date),
    reportStock(db, clock, date),
    countOutsideShop(db, date),
    sumPendingReturns(db, clock),
  ]);
  /** The cylinders that bills of one type moved on the dates, both ends included. */
  const moved = (type: ActivityType, from: string, to = from) =>
    activity.filter((row) => row.type === type && row.date >= from && row.date <= to);
  const sentOn = (day: string) => ({ date: day, quantity: sum(moved("dispatch", day)) });
  /** What was dispatched on the dates, both ends included. */
  const sentIn = (from: string, to: string) => ({
    from,
    to,
    quantity: sum(moved("dispatch", from, to)),
  });
  // Last month may have no such day, as February has no 30th.
  const sameDay = `${lastMonthEnd.slice(0, 7)}-${date.slice(8)}`;
  const dispatched = countedByGas(moved("dispatch", date));
  const received = countedByGas(moved("return_from_customer", date));
  return {
    date,
    startDate: stock.startDate,
    dispatched: {
      ...dispatched,
      customers,
      lastWeek: sentOn(addDays(date, -7)),
      days: [-6, -5, -4, -3, -2, -1, 0].map((days) => sentOn(addDays(date, days))),
      thisMonth: sentIn(monthStart, date),
      lastMonth: sentIn(lastMonthStart, sameDay < lastMonthEnd ? sameDay : lastMonthEnd),
    },
    received,
    netOut: dispatched.quantity - received.quantity,
    billsEntered,
    refillerMovements: {
      sent: sum(moved("send_to_refiller", date)),
      received: sum(moved("return_from_refiller", date)),
    },
    cylinders: totalCylinders(stock.rows, outside),
    pendingReturns,
    belowZero: {
      shop: stock.rows.flatMap((row) => Object.values(row.shop)).filter((count) => count < 0)
        .length,
      parties: outside.belowZero,
    },
  };
}

/**
 * The types of bill whose cylinders count as today's activity: those sent to
 * customers and refillers, and those that come back from them. Opening stock is
 * where the counts start rather than activity.
 */
const ACTIVITY_TYPES = [
  "dispatch",
  "return_from_customer",
  "send_to_refiller",
  "return_from_refiller",
] as const satisfies BillType[];

type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** The cylinders of one gas that posted bills of one type moved on one date. */
interface Activity {
  date: string;
  type: ActivityType;
  gasId: string;
  gasName: string;
  quantity: number;
}

/** What moved on the dates, both ends included, in the order of the gases. */
async function findActivity(db: Database, from: string, to: string): Promise<Activity[]> {
  const rows = await db.$queryRaw<(Omit<Activity, "date"> & { date: Date })[]>`
    SELECT b.date, b.type::text AS type, g.id AS "gasId", g.name::text AS "gasName",
           SUM(l.quantity)::int AS quantity
      FROM bills b
      JOIN bill_lines l ON l.bill_id = b.id
      JOIN gases g ON g.id = l.gas_id
     WHERE b.status = 'posted' AND b.type::text IN (${Prisma.join([...ACTIVITY_TYPES])})
       AND b.date BETWEEN ${from}::date AND ${to}::date
     GROUP BY b.date, b.type, g.id
     ORDER BY g.sort_order, g.name
  `;
  return rows.map((row) => ({ ...row, date: fromDatabaseDate(row.date) }));
}

/** How many customers posted dispatch bills dated the day sent cylinders to. */
async function countCustomersSentTo(db: Database, date: string): Promise<number> {
  const [{ customers }] = await db.$queryRaw<[{ customers: number }]>`
    SELECT COUNT(DISTINCT to_party_id)::int AS customers
      FROM bills
     WHERE status = 'posted' AND type = 'dispatch' AND date = ${date}::date
  `;
  return customers;
}

/** The stock report's rows added up, with how many parties hold what is out. */
function totalCylinders(
  rows: StockReportRow[],
  outside: Awaited<ReturnType<typeof countOutsideShop>>,
): Dashboard["cylinders"] {
  const add = (count: (row: StockReportRow) => number) =>
    rows.reduce((total, row) => total + count(row), 0);
  const filled = add((row) => row.shop.filled);
  const empty = add((row) => row.shop.empty);
  const defective = add((row) => row.shop.defective);
  return {
    total: add((row) => row.total),
    shop: { filled, empty, defective, total: countAtShop({ filled, empty, defective }) },
    customers: { held: add((row) => row.customers), ...outside.customer },
    refillers: { held: add((row) => row.refillers), ...outside.refiller },
    gases: rows,
  };
}

/** The posted bills entered on the date, which the bill list gives for the same date. */
async function countBillsEntered(db: Database, date: string): Promise<Dashboard["billsEntered"]> {
  const { _count, _max } = await db.bill.aggregate({
    where: { status: "posted", enteredAt: enteredDuring(date) },
    _count: true,
    _max: { enteredAt: true },
  });
  return { count: _count, lastEnteredAt: _max.enteredAt?.toISOString() ?? null };
}

/** The activity of one day and type, all together and gas by gas. */
function countedByGas(activity: Activity[]): { quantity: number; gases: GasHeld[] } {
  const { total, gases } = heldBy(activity);
  return { quantity: total, gases };
}

function sum(rows: { quantity: number }[]): number {
  return rows.reduce((total, { quantity }) => total + quantity, 0);
}
