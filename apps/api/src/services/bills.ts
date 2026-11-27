import {
  addDays,
  indianDayStart,
  billContentSchema,
  HOLDER_TYPES,
  PARTY_TYPES,
  type Bill,
  type BillContent,
  type BillListQuery,
  type BillNumberUseQuery,
  type OpeningStockListQuery,
  type RefillerSlipNumberUseQuery,
} from "@gasflow/shared";
import { containing, type Database, type Transaction } from "../database";
import { fromDatabaseDate, toDatabaseDate } from "../database-date";
import type { Prisma } from "../generated/prisma/client";
import { Refusal } from "../refusal";
import { countDispatchReturns, findPendingDispatchIds, getBillReturns } from "./pending";

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
      ...CONTENT,
      slipNumber: true,
      enteredBy: { select: STAFF },
      enteredAt: true,
      cancelReason: true,
      cancelNotes: true,
      cancelledBy: { select: STAFF },
      cancelledAt: true,
      revisions: {
        select: { content: true, replacedBy: { select: STAFF }, replacedAt: true },
        orderBy: { version: "asc" },
      },
    },
  });
  if (!bill) {
    throw noSuchBill();
  }
  const { enteredAt, cancelReason, cancelNotes, cancelledBy, cancelledAt, revisions, ...rest } =
    bill;
  const last = revisions.at(-1);
  return {
    ...asReported(rest),
    enteredAt: enteredAt.toISOString(),
    lastCorrection: last
      ? { correctedBy: last.replacedBy, correctedAt: last.replacedAt.toISOString() }
      : null,
    // Each version was saved by whoever replaced the one before it, and the first
    // by whoever entered the bill.
    earlierVersions: revisions.map(({ content }, index) => {
      const before = revisions[index - 1];
      return {
        ...billContentSchema.parse(content),
        savedBy: before?.replacedBy ?? rest.enteredBy,
        savedAt: (before?.replacedAt ?? enteredAt).toISOString(),
      };
    }),
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

/** What a bill says now that a correction can change, as the API reports it. */
export async function readContent(tx: Transaction, billId: string): Promise<BillContent> {
  const where = { id: billId };
  const { fromParty, toParty, vehicle, ...columns } = CONTENT;
  // One relation at a time, since a transaction's one connection cannot run the
  // queries for several side by side.
  const bill = {
    ...(await tx.bill.findUniqueOrThrow({ where, select: columns })),
    ...(await tx.bill.findUniqueOrThrow({ where, select: { fromParty } })),
    ...(await tx.bill.findUniqueOrThrow({ where, select: { toParty } })),
    ...(await tx.bill.findUniqueOrThrow({ where, select: { vehicle } })),
  };
  return billContentSchema.parse(asReported(bill));
}

/** One page of the bills, of either status unless one is asked for, the newest first. */
export async function listBills(db: Database, query: BillListQuery) {
  const { page } = query;
  const where = await whereAsked(db, query);
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
  const counts = await countDispatchReturns(
    db,
    bills.map((bill) => bill.id),
  );
  return {
    bills: bills.map((bill) => ({ ...asReported(bill), returns: counts.get(bill.id) ?? null })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** The bills that meet everything asked of them. */
async function whereAsked(
  db: Database,
  {
    number,
    slipNumber,
    paperKind,
    type,
    party,
    partyId,
    from,
    to,
    enteredOn,
    status,
    pending,
  }: BillListQuery,
): Promise<Prisma.BillWhereInput> {
  // The shop is on nearly every bill, so its name finds none of them.
  const partyNamed = party
    ? { type: { in: [...PARTY_TYPES] }, name: containing(party) }
    : undefined;
  return {
    id: pending ? { in: await findPendingDispatchIds(db) } : undefined,
    number: number ? containing(number) : undefined,
    slipNumber: slipNumber ? containing(slipNumber) : undefined,
    paperKind,
    type,
    status,
    date: {
      gte: from && toDatabaseDate(from),
      lte: to && toDatabaseDate(to),
    },
    enteredAt: enteredOn ? enteredDuring(enteredOn) : undefined,
    // Each of these is met by either side of a bill.
    AND: [
      partyNamed ? { OR: [{ fromParty: partyNamed }, { toParty: partyNamed }] } : {},
      partyId ? { OR: [{ fromPartyId: partyId }, { toPartyId: partyId }] } : {},
    ],
  };
}

/** The moments of the date in India, for narrowing bills by when they were entered. */
export function enteredDuring(date: string): Prisma.DateTimeFilter<"Bill"> {
  return { gte: indianDayStart(date), lt: indianDayStart(addDays(date, 1)) };
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

/** The columns that hold what a correction can change. */
const CONTENT = {
  paperKind: true,
  number: true,
  date: true,
  fromParty: { select: PARTY },
  toParty: { select: PARTY },
  vehicle: { select: { id: true, plate: true, label: true } },
  notes: true,
  writeOffReason: true,
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

/** What a list of bills shows of each one. */
const SUMMARY = {
  id: true,
  type: true,
  paperKind: true,
  number: true,
  date: true,
  status: true,
  fromParty: CONTENT.fromParty,
  toParty: CONTENT.toParty,
  writeOffReason: true,
  lines: CONTENT.lines,
} as const;
