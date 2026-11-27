import {
  holdsCylinders,
  PARTY_TYPES,
  partySchema,
  type NewParty,
  type PartyChanges,
  type PartyListQuery,
} from "@gasflow/shared";
import { containing, type Database, type Transaction } from "../database";
import { Refusal } from "../refusal";
import { abbreviate } from "./abbreviation";
import { findHoldings } from "./holdings";
import { countUnmatchedOf } from "./unmatched";

const PAGE_SIZE = 50;

/** One page of customers, refillers and suppliers, by name. */
export async function listParties(db: Database, query: PartyListQuery) {
  const { search, type, inactive, holders, page } = query;
  const types = type ? [type] : [...PARTY_TYPES];
  const where = {
    type: { in: holders ? types.filter(holdsCylinders) : types },
    active: inactive ? undefined : true,
    name: search ? containing(search) : undefined,
  };
  const [parties, total] = await db.$transaction([
    db.party.findMany({
      where,
      select: PARTY,
      // The id keeps parties of one name in the same order on every page.
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.party.count({ where }),
  ]);
  return { parties, total, page, pageSize: PAGE_SIZE };
}

export async function createParty(db: Database, party: NewParty) {
  const abbreviation = party.abbreviation ?? abbreviate(party.name);
  return db.party.create({ data: { ...party, abbreviation }, select: PARTY });
}

/** A customer, refiller or supplier. The shop is not one of these. */
export async function getParty(db: Database, partyId: string) {
  const party = await findParty(db, partyId);
  if (party.type === "shop") {
    throw noSuchParty();
  }
  return party;
}

/**
 * Changes what is mentioned. An abbreviation made blank is made from the name
 * again. A party with cylinders or unmatched returns cannot be deactivated.
 */
export function changeParty(db: Database, partyId: string, changes: PartyChanges) {
  return db.$transaction(async (tx) => {
    // Held, so that no bill can be saved for the party between the checks and the change.
    const party = await lockParty(tx, partyId);
    if (party.type === "shop") {
      throw new Refusal(409, "The shop cannot be changed.");
    }
    // One that is already inactive can still be edited, whatever it has come to hold.
    if (party.active && changes.active === false) {
      await refuseWhileOpen(tx, partyId, party.name);
    }
    const abbreviation =
      changes.abbreviation === null ? abbreviate(changes.name ?? party.name) : changes.abbreviation;
    return tx.party.update({
      where: { id: partyId },
      data: { ...changes, abbreviation },
      select: PARTY,
    });
  });
}

/**
 * The party, held until the transaction ends, so that two saves for one party
 * take turns. Bills can still name it in the meantime.
 */
export async function lockParty(tx: Transaction, partyId: string) {
  await tx.$queryRaw`SELECT 1 FROM parties WHERE id = ${partyId}::uuid FOR NO KEY UPDATE`;
  const party = await tx.party.findUnique({
    where: { id: partyId },
    select: { name: true, type: true, active: true },
  });
  if (!party) {
    throw noSuchParty();
  }
  return party;
}

/**
 * Refuses to hide a party with matters still open: cylinders it holds, even fewer
 * than none, or returns not yet matched to a bill. Says what they are.
 */
async function refuseWhileOpen(tx: Transaction, partyId: string, name: string): Promise<void> {
  const held = await findHoldings(tx, [partyId]);
  const unmatched = await countUnmatchedOf(tx, partyId);
  const reasons: string[] = [];
  if (held.length > 0) {
    reasons.push(`It holds ${listed(held)}.`);
  }
  if (unmatched.length > 0) {
    reasons.push(`It has ${listed(unmatched)} unmatched.`);
  }
  if (reasons.length > 0) {
    throw new Refusal(409, [`${name} cannot be deactivated.`, ...reasons].join(" "));
  }
}

/** Counts of gases as one reads them, such as "5 Argon, 2 Air and 1 Nitrogen". */
function listed(counts: { gasName: string; quantity: number }[]): string {
  return LIST.format(counts.map(({ gasName, quantity }) => `${quantity} ${gasName}`));
}

const LIST = new Intl.ListFormat("en-GB");

export function noSuchParty(): Refusal {
  return new Refusal(404, "There is no such party.");
}

/** Any party, including the shop. */
async function findParty(db: Database, partyId: string) {
  const party = await db.party.findUnique({ where: { id: partyId }, select: PARTY });
  if (!party) {
    throw noSuchParty();
  }
  return party;
}

/** The columns the API reports for a party. */
const PARTY = {
  id: true,
  type: true,
  name: true,
  abbreviation: true,
  mobile: true,
  contactPerson: true,
  address: true,
  notes: true,
  active: true,
} as const satisfies Record<keyof typeof partySchema.shape, true>;
