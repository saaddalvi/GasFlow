import {
  PARTY_TYPES,
  partySchema,
  type NewParty,
  type PartyChanges,
  type PartyListQuery,
} from "@gasflow/shared";
import type { Database } from "../database";
import { Refusal } from "../refusal";
import { abbreviate } from "./abbreviation";

const PAGE_SIZE = 50;

/** One page of customers, refillers and suppliers, by name. */
export async function listParties(db: Database, query: PartyListQuery) {
  const { search, type, inactive, page } = query;
  const where = {
    type: type ?? { in: [...PARTY_TYPES] },
    active: inactive ? undefined : true,
    name: search ? { contains: likeLiteral(search), mode: "insensitive" as const } : undefined,
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

/** Changes what is mentioned. An abbreviation made blank is made from the name again. */
export async function changeParty(db: Database, partyId: string, changes: PartyChanges) {
  const party = await findParty(db, partyId);
  if (party.type === "shop") {
    throw new Refusal(409, "The shop cannot be changed.");
  }
  const abbreviation =
    changes.abbreviation === null ? abbreviate(changes.name ?? party.name) : changes.abbreviation;
  return db.party.update({
    where: { id: partyId },
    data: { ...changes, abbreviation },
    select: PARTY,
  });
}

export function noSuchParty(): Refusal {
  return new Refusal(404, "There is no such party.");
}

/** The text as itself in a LIKE pattern, which Prisma leaves to its caller. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
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
