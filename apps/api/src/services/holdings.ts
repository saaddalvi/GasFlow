import {
  firstOfMonth,
  lastOfMonth,
  type DailySummary,
  type DailySummaryQuery,
  type PartyHolding,
  type PartySummary,
  type RegisterParty,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database, Transaction } from "../database";
import { fromDatabaseDate } from "../database-date";
import { Prisma } from "../generated/prisma/client";

// What parties hold, and what is sent to them and returned, worked out from the
// posted bills. No count is stored anywhere.

const PAGE_SIZE = 50;

/**
 * What each line of a posted bill brought to a party, and, as a negative
 * quantity, what it took from one. Whoever reads it says which parties count and
 * up to what date.
 */
export const MOVEMENTS = Prisma.sql`
  SELECT b.to_party_id AS party_id, b.date, b.type AS bill_type, l.gas_id, l.fill_state,
         l.quantity, b.id AS bill_id, l.line_no
    FROM bills b JOIN bill_lines l ON l.bill_id = b.id
   WHERE b.status = 'posted'
   UNION ALL
  SELECT b.from_party_id, b.date, b.type, l.gas_id, l.fill_state, -l.quantity, b.id, l.line_no
    FROM bills b JOIN bill_lines l ON l.bill_id = b.id
   WHERE b.status = 'posted'
`;

export interface Holding {
  partyId: string;
  gasId: string;
  gasName: string;
  /** Below zero when bills take away more than were there, and never zero. */
  quantity: number;
}

/**
 * What each of these customers and refillers holds of each gas it has any of, in
 * the order of the gases, counting every posted bill dated no later than the date,
 * or whatever its date if none is given. Fill state counts only for the shop, so it
 * is added across. Anyone else holds nothing here.
 */
export function findHoldings(
  db: Database | Transaction,
  partyIds: string[],
  date?: string,
): Promise<Holding[]> {
  return db.$queryRaw<Holding[]>`
    SELECT m.party_id AS "partyId", g.id AS "gasId", g.name::text AS "gasName",
           SUM(m.quantity)::int AS quantity
      FROM (${MOVEMENTS}) m
      JOIN parties p ON p.id = m.party_id AND p.type IN ('customer', 'refiller')
      JOIN gases g ON g.id = m.gas_id
     WHERE m.party_id = ANY(${partyIds}::uuid[])
       AND m.date <= COALESCE(${date ?? null}::date, m.date)
     GROUP BY m.party_id, g.id
    HAVING SUM(m.quantity) <> 0
     ORDER BY g.sort_order, g.name
  `;
}

/**
 * These customers and refillers, each with what it held, gas by gas and all
 * together, as findHoldings counts it.
 */
export async function withHoldings<Party extends { id: string }>(
  db: Database | Transaction,
  parties: Party[],
  date?: string,
) {
  const holdings = await findHoldings(
    db,
    parties.map((party) => party.id),
    date,
  );
  const held = new Map<string, Holding[]>(parties.map((party) => [party.id, []]));
  // Only these parties were asked about.
  for (const holding of holdings) held.get(holding.partyId)!.push(holding);
  // Each party was given a list above.
  return parties.map((party) => ({ ...party, ...heldBy(held.get(party.id)!) }));
}

/**
 * How many customers, and how many refillers, held some of any gas, or fewer than
 * none, at the end of the day, and how many counts of theirs, one for each party
 * and gas, were below zero.
 */
export async function countOutsideShop(
  db: Database,
  date: string,
): Promise<Record<RegisterParty["type"], { parties: number }> & { belowZero: number }> {
  const rows = await db.$queryRaw<
    { type: RegisterParty["type"]; parties: number; belowZero: number }[]
  >`
    WITH held AS (
      SELECT p.id AS party_id, p.type, SUM(m.quantity) AS quantity
        FROM (${MOVEMENTS}) m
        JOIN parties p ON p.id = m.party_id AND p.type IN ('customer', 'refiller')
       WHERE m.date <= ${date}::date
       GROUP BY p.id, m.gas_id
      HAVING SUM(m.quantity) <> 0
    )
    SELECT type::text AS type, COUNT(DISTINCT party_id)::int AS parties,
           COUNT(*) FILTER (WHERE quantity < 0)::int AS "belowZero"
      FROM held
     GROUP BY type
  `;
  const of = (type: RegisterParty["type"]) => ({
    parties: rows.find((row) => row.type === type)?.parties ?? 0,
  });
  return {
    customer: of("customer"),
    refiller: of("refiller"),
    belowZero: rows.reduce((total, row) => total + row.belowZero, 0),
  };
}

/** What the party holds now, and what has been sent to it and returned this month. */
export async function getPartyHolding(
  db: Database,
  clock: Clock,
  partyId: string,
): Promise<PartyHolding> {
  const month = monthOf(today(clock));
  const [held, movement] = await Promise.all([
    findHoldings(db, [partyId]),
    sumMovement(db, partyId, month),
  ]);
  return { ...heldBy(held), thisMonth: { ...month, ...movement } };
}

/** Counts of one gas each, as they are reported: gas by gas, and all together. */
export function heldBy(holdings: Pick<Holding, "gasId" | "gasName" | "quantity">[]) {
  return {
    gases: holdings.map(({ gasId, gasName, quantity }) => ({
      gas: { id: gasId, name: gasName },
      quantity,
    })),
    total: holdings.reduce((sum, { quantity }) => sum + quantity, 0),
  };
}

/** The first and last days of the date's month. */
function monthOf(date: string): { from: string; to: string } {
  return { from: firstOfMonth(date), to: lastOfMonth(date) };
}

// The types of bill that send cylinders to a party, and that bring them back.
const SENDS = Prisma.sql`('dispatch', 'send_to_refiller')`;
const RETURNS = Prisma.sql`('return_from_customer', 'return_from_refiller')`;

/**
 * Each line of a posted bill that sends cylinders to a party or brings them back
 * from one, with how many it sends and how many it brings back. Opening stock and
 * write-offs are neither.
 */
const SENT_AND_RETURNED = Prisma.sql`
  SELECT CASE WHEN b.type IN ${SENDS} THEN b.to_party_id ELSE b.from_party_id END AS party_id,
         b.date, l.gas_id,
         CASE WHEN b.type IN ${SENDS} THEN l.quantity ELSE 0 END AS sent,
         CASE WHEN b.type IN ${RETURNS} THEN l.quantity ELSE 0 END AS returned
    FROM bills b JOIN bill_lines l ON l.bill_id = b.id
   WHERE b.status = 'posted' AND (b.type IN ${SENDS} OR b.type IN ${RETURNS})
`;

/** What was sent to the party and returned by it on the dates, both ends included. */
async function sumMovement(
  db: Database,
  partyId: string,
  { from, to }: { from: string; to: string },
) {
  const [{ sent, returned }] = await db.$queryRaw<[{ sent: number; returned: number }]>`
    SELECT COALESCE(SUM(m.sent), 0)::int AS sent,
           COALESCE(SUM(m.returned), 0)::int AS returned
      FROM (${SENT_AND_RETURNED}) m
     WHERE m.party_id = ${partyId}::uuid
       AND m.date BETWEEN ${from}::date AND ${to}::date
  `;
  return { sent, returned, netOut: sent - returned };
}

/** One page of the days cylinders were sent to the party or returned by it, the newest first. */
export async function listMovementDays(
  db: Database,
  partyId: string,
  { from, to, page }: DailySummaryQuery,
): Promise<DailySummary> {
  // A date left out bounds nothing.
  const moved = Prisma.sql`
    FROM (${SENT_AND_RETURNED}) m
    JOIN gases g ON g.id = m.gas_id
   WHERE m.party_id = ${partyId}::uuid
     AND m.date >= COALESCE(${from ?? null}::date, m.date)
     AND m.date <= COALESCE(${to ?? null}::date, m.date)
  `;
  const [dates, [{ total }]] = await Promise.all([
    db.$queryRaw<{ date: Date }[]>`
      SELECT DISTINCT m.date ${moved}
       ORDER BY m.date DESC
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `,
    db.$queryRaw<[{ total: number }]>`
      SELECT COUNT(DISTINCT m.date)::int AS total ${moved}
    `,
  ]);
  const rows = await db.$queryRaw<DayOfGas[]>`
    SELECT m.date, g.id AS "gasId", g.name::text AS "gasName",
           SUM(m.sent)::int AS sent, SUM(m.returned)::int AS returned
      ${moved} AND m.date = ANY(${dates.map(({ date }) => fromDatabaseDate(date))}::date[])
     GROUP BY m.date, g.id
     ORDER BY m.date DESC, g.sort_order, g.name
  `;
  const days = new Map<string, DailySummary["days"][number]>();
  for (const { date: moment, gasId, gasName, sent, returned } of rows) {
    const date = fromDatabaseDate(moment);
    const day = days.get(date) ?? { date, sent: 0, returned: 0, netOut: 0, gases: [] };
    days.set(date, day);
    day.sent += sent;
    day.returned += returned;
    day.netOut += sent - returned;
    day.gases.push({ gas: { id: gasId, name: gasName }, sent, returned });
  }
  return { days: [...days.values()], total, page, pageSize: PAGE_SIZE };
}

interface DayOfGas {
  date: Date;
  gasId: string;
  gasName: string;
  sent: number;
  returned: number;
}

/** The cylinders held by customers and by refillers, and how many of them are below zero. */
export async function sumHoldings(
  db: Database,
): Promise<Pick<PartySummary, "withCustomers" | "atRefillers" | "belowZero">> {
  const [sums] = await db.$queryRaw<
    [Pick<PartySummary, "withCustomers" | "atRefillers" | "belowZero">]
  >`
    WITH held AS (
      SELECT p.id AS party_id, p.type, SUM(m.quantity) AS quantity
        FROM (${MOVEMENTS}) m
        JOIN parties p ON p.id = m.party_id AND p.type IN ('customer', 'refiller')
       GROUP BY p.id, m.gas_id
    )
    SELECT COALESCE(SUM(quantity) FILTER (WHERE type = 'customer'), 0)::int AS "withCustomers",
           COALESCE(SUM(quantity) FILTER (WHERE type = 'refiller'), 0)::int AS "atRefillers",
           COUNT(DISTINCT party_id) FILTER (WHERE quantity < 0)::int AS "belowZero"
      FROM held
  `;
  return sums;
}
