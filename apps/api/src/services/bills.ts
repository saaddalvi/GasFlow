import {
  HOLDER_TYPES,
  type Bill,
  type BillListQuery,
  type BillNumberUseQuery,
  type OpeningStockListQuery,
} from "@gasflow/shared";
import type { Database } from "../database";
import { fromDatabaseDate } from "../database-date";
import { Refusal } from "../refusal";

// Reading bills. Only the ledger changes them.

const PAGE_SIZE = 50;

/** The opening stock that counts. A party has at most one. */
export const POSTED_OPENING_STOCK = { type: "opening_stock", status: "posted" } as const;

/** A bill with everything on it. */
export async function getBill(db: Database, billId: string): Promise<Bill> {
  const bill = await db.bill.findUnique({
    where: { id: billId },
    select: {
      ...SUMMARY,
      vehicle: { select: { id: true, plate: true, label: true } },
      notes: true,
      enteredBy: { select: STAFF },
      enteredAt: true,
    },
  });
  if (!bill) {
    throw noSuchBill();
  }
  const { enteredAt, ...rest } = bill;
  return { ...asReported(rest), enteredAt: enteredAt.toISOString() };
}

/** One page of all the bills, the newest first. */
export async function listBills(db: Database, { page }: BillListQuery) {
  // Not in a transaction, whose one connection cannot run the queries for a
  // bill's parties and lines side by side.
  const [bills, total] = await Promise.all([
    db.bill.findMany({
      select: SUMMARY,
      // The id keeps bills entered at one moment in the same order on every page.
      orderBy: [{ date: "desc" }, { enteredAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.bill.count(),
  ]);
  return { bills: bills.map(asReported), total, page, pageSize: PAGE_SIZE };
}

/** The posted bill that has this number on this paper kind, if there is one. */
export async function findNumberUse(db: Database, { paperKind, number }: BillNumberUseQuery) {
  const bill = await db.bill.findFirst({
    where: { paperKind, number, status: "posted" },
    select: { id: true, date: true },
  });
  return { usedBy: bill && { id: bill.id, date: fromDatabaseDate(bill.date) } };
}

/** One page of the parties' posted opening stock, by party name. */
export async function listOpeningStock(db: Database, { page }: OpeningStockListQuery) {
  const where = POSTED_OPENING_STOCK;
  // Not in a transaction, whose one connection cannot run the queries for a
  // bill's party, lines and staff side by side.
  const [bills, total] = await Promise.all([
    db.bill.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        toParty: { select: PARTY },
        lines: { select: { quantity: true } },
        enteredBy: { select: STAFF },
        enteredAt: true,
      },
      // The id keeps parties of one name in the same order on every page.
      orderBy: [{ toParty: { name: "asc" } }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.bill.count({ where }),
  ]);
  const entries = bills.map(({ toParty, lines, date, enteredAt, ...bill }) => ({
    ...bill,
    date: fromDatabaseDate(date),
    party: toParty,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    enteredAt: enteredAt.toISOString(),
  }));
  return { entries, total, page, pageSize: PAGE_SIZE };
}

/**
 * The parties whose opening stock can still be entered: the shop first, then the
 * active customers and refillers by name.
 */
export async function listOpeningStockParties(db: Database) {
  const parties = await db.party.findMany({
    where: {
      type: { in: [...HOLDER_TYPES] },
      active: true,
      billsTo: { none: POSTED_OPENING_STOCK },
    },
    select: PARTY,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return [
    ...parties.filter((party) => party.type === "shop"),
    ...parties.filter((party) => party.type !== "shop"),
  ];
}

export function noSuchBill(): Refusal {
  return new Refusal(404, "There is no such bill.");
}

/** A bill's own columns as the API names them: a plain date, and who is on each side. */
function asReported<Row extends { date: Date; fromParty: unknown; toParty: unknown }>({
  date,
  fromParty,
  toParty,
  ...rest
}: Row) {
  return {
    ...rest,
    date: fromDatabaseDate(date),
    from: fromParty as Row["fromParty"],
    to: toParty as Row["toParty"],
  };
}

/** The columns the API reports for a party named on a bill. */
const PARTY = { id: true, name: true, type: true } as const;

/** The columns the API reports for whoever entered a bill. */
const STAFF = { id: true, displayName: true } as const;

/** What a list of bills shows of each one. */
const SUMMARY = {
  id: true,
  type: true,
  paperKind: true,
  number: true,
  date: true,
  status: true,
  fromParty: { select: PARTY },
  toParty: { select: PARTY },
  lines: {
    select: {
      id: true,
      gas: { select: { id: true, name: true } },
      fillState: true,
      quantity: true,
    },
    orderBy: { lineNo: "asc" },
  },
} as const;
