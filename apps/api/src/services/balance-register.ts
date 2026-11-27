import {
  isBelowZero,
  REGISTER_PARTY_TYPES,
  type BalanceRegister,
  type BalanceRegisterQuery,
  type RegisterParty,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import { containing, type Database } from "../database";
import { withHoldings } from "./holdings";
import { getStartDate } from "./setup";

const PAGE_SIZE = 50;

/** Which parties each choice of what to show lists. */
const SHOWN: Record<BalanceRegisterQuery["show"], (party: RegisterParty) => boolean> = {
  // A party with a gas above zero and another below may total nothing.
  non_zero: (party) => party.gases.length > 0,
  below_zero: isBelowZero,
  all: () => true,
};

/**
 * What each customer and refiller held at the end of a day, worked out from the
 * posted bills. No count is stored anywhere.
 */
export async function reportBalanceRegister(
  db: Database,
  clock: Clock,
  query: BalanceRegisterQuery,
): Promise<BalanceRegister> {
  const { date = today(clock), show, page } = query;
  const startDate = await getStartDate(db);
  // There are no records of a day before the start date.
  const listed =
    startDate && date >= startDate
      ? (await findRegisterParties(db, date, query)).filter(SHOWN[show])
      : [];
  return {
    date,
    startDate,
    parties: listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    summary: {
      held: listed.reduce((sum, party) => sum + party.total, 0),
      belowZero: listed.filter(isBelowZero).length,
    },
    total: listed.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Every customer and refiller of the type and name asked for, by name, with what
 * it held. All of them are read, because the header adds up every page.
 */
async function findRegisterParties(
  db: Database,
  date: string,
  { type, search }: BalanceRegisterQuery,
): Promise<RegisterParty[]> {
  const parties = await db.party.findMany({
    // Inactive ones too, which may have held cylinders on the day.
    where: {
      type: type ?? { in: [...REGISTER_PARTY_TYPES] },
      name: search ? containing(search) : undefined,
    },
    select: { id: true, type: true, name: true, active: true },
    // The id keeps parties of one name in the same order on every page.
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const held = await withHoldings(db, parties, date);
  // The query gives only these types.
  return held.map((party) => ({ ...party, type: party.type as RegisterParty["type"] }));
}
