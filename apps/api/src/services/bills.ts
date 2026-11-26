import {
  HOLDER_TYPES,
  type Bill,
  type BillListQuery,
  type BillNumberUseQuery,
  type OpeningStockListQuery,
  type RefillerSlipNumberUseQuery,
} from "@gasflow/shared";
import type { Database } from "../database";
import { fromDatabaseDate } from "../database-date";
import type { Prisma } from "../generated/prisma/client";
import { Refusal } from "../refusal";
import { getBillReturns } from "./pending";

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
      slipNumber: true,
      vehicle: { select: { id: true, plate: true, label: true } },
      notes: true,
      enteredBy: { select: STAFF },
      enteredAt: true,
      cancelReason: true,
      cancelNotes: true,
      cancelledBy: { select: STAFF },
      cancelledAt: true,
    },
  });
  if (!bill) {
    throw noSuchBill();
  }
  const { enteredAt, cancelReason, cancelNotes, cancelledBy, cancelledAt, ...rest } = bill;
  return {
    ...asReported(rest),
    enteredAt: enteredAt.toISOString(),
    // A cancelled bill has a reason, someone who gave it and a time, by a check
    // in the database. No other bill has any of them.
    cancellation:
      rest.status === "cancelled"
        ? {
            reason: cancelReason!,
            notes: cancelNotes,
            cancelledBy: cancelledBy!,
            cancelledAt: cancelledAt!.toISOString(),
          }
        : null,
    returns: await getBillReturns(db, bill),
  };
}

/** One page of the bills, of either status unless one is asked for, the newest first. */
export async function listBills(db: Database, { status, page }: BillListQuery) {
  const where = { status };
  // Not in a transaction, whose one connection cannot run the queries for a
  // bill's parties and lines side by side.
  const [bills, total] = await Promise.all([
    db.bill.findMany({
      where,
      select: SUMMARY,
      // The id keeps bills entered at one moment in the same order on every page.
      orderBy: [{ date: "desc" }, { enteredAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.bill.count({ where }),
  ]);
  return { bills: bills.map(asReported), total, page, pageSize: PAGE_SIZE };
}

/** The posted bill that has this number on this paper kind, if there is one. */
export function findNumberUse(db: Database, { paperKind, number }: BillNumberUseQuery) {
  return findUse(db, { paperKind, number });
}

/** The posted return from this refiller that has this number of theirs, if there is one. */
export function findRefillerSlipNumberUse(
  db: Database,
  { refillerId, number }: RefillerSlipNumberUseQuery,
) {
  return findUse(db, { type: "return_from_refiller", fromPartyId: refillerId, number });
}

/** The posted bill that matches, as the form is told of one that has a number. */
async function findUse(db: Database, where: Prisma.BillWhereInput) {
  const bill = await db.bill.findFirst({
    where: { ...where, status: "posted" },
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
