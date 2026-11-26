import { HOLDER_TYPES, type Bill, type OpeningStockListQuery } from "@gasflow/shared";
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
      id: true,
      type: true,
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
      enteredBy: { select: STAFF },
      enteredAt: true,
    },
  });
  if (!bill) {
    throw noSuchBill();
  }
  const { fromParty, toParty, date, enteredAt, ...rest } = bill;
  return {
    ...rest,
    date: fromDatabaseDate(date),
    from: fromParty,
    to: toParty,
    enteredAt: enteredAt.toISOString(),
  };
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

/** The columns the API reports for a party named on a bill. */
const PARTY = { id: true, name: true, type: true } as const;

/** The columns the API reports for whoever entered a bill. */
const STAFF = { id: true, displayName: true } as const;
