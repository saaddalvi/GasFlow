import {
  holdsCylinders,
  type PartyListQuery,
  type PartySummary,
  type PartyType,
  type ReportedParty,
} from "@gasflow/shared";
import type { Database } from "../database";
import { fromDatabaseDate } from "../database-date";
import { findHoldings, heldBy, sumHoldings } from "./holdings";
import { listParties } from "./parties";

/** One page of the parties asked for, each with what it holds and its last bill. */
export async function reportParties(db: Database, query: PartyListQuery) {
  const { parties, ...page } = await listParties(db, query);
  const ids = parties.map((party) => party.id);
  const [holdings, lastBills, sums, active] = await Promise.all([
    findHoldings(db, ids),
    findLastBills(db, ids),
    sumHoldings(db),
    countActive(db),
  ]);
  return {
    ...page,
    parties: parties.map((party) => ({
      ...party,
      holding:
        // The query gives no shop.
        holdsCylinders(party.type as PartyType)
          ? heldBy(holdings.filter((holding) => holding.partyId === party.id))
          : null,
      lastBill: lastBills.get(party.id) ?? null,
    })),
    summary: { active, ...sums },
  };
}

type LastBill = NonNullable<ReportedParty["lastBill"]>;

/**
 * The latest-dated posted bill that names each of these parties, by the party's
 * id, and of those on one date the one entered last.
 */
async function findLastBills(db: Database, partyIds: string[]): Promise<Map<string, LastBill>> {
  const rows = await db.$queryRaw<(Omit<LastBill, "date"> & { partyId: string; date: Date })[]>`
    SELECT DISTINCT ON (side.party_id)
           side.party_id AS "partyId", b.id, b.type::text AS type,
           b.paper_kind::text AS "paperKind", b.number::text AS number, b.date
      FROM bills b
     CROSS JOIN LATERAL (VALUES (b.from_party_id), (b.to_party_id)) AS side (party_id)
     WHERE b.status = 'posted'
       AND (b.from_party_id = ANY(${partyIds}::uuid[]) OR b.to_party_id = ANY(${partyIds}::uuid[]))
       AND side.party_id = ANY(${partyIds}::uuid[])
     ORDER BY side.party_id, b.date DESC, b.entered_at DESC, b.id DESC
  `;
  return new Map(
    rows.map(({ partyId, date, ...bill }) => [partyId, { ...bill, date: fromDatabaseDate(date) }]),
  );
}

async function countActive(db: Database): Promise<PartySummary["active"]> {
  const counts = await db.party.groupBy({
    by: ["type"],
    where: { active: true },
    _count: true,
  });
  const of = (type: PartyType) => counts.find((count) => count.type === type)?._count ?? 0;
  return { customer: of("customer"), refiller: of("refiller"), supplier: of("supplier") };
}
