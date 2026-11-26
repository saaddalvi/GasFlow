import type { NewBillLine, NewOpeningStock, Staff } from "@gasflow/shared";
import type { Clock } from "../clock";
import type { Database, Transaction } from "../database";
import { toDatabaseDate } from "../database-date";
import { Refusal } from "../refusal";
import { POSTED_OPENING_STOCK } from "./bills";
import { noSuchGas } from "./gases";
import { noSuchParty } from "./parties";
import { getStartDate } from "./setup";

// The bill ledger: the one place that changes bills. Each operation checks every
// rule and writes inside a single transaction, so that a bill is saved whole or
// not at all. Reading bills is done elsewhere.

/** Records what a party held on the start date, and gives the new bill's id. */
export function enterOpeningStock(
  db: Database,
  clock: Clock,
  staff: Staff,
  { partyId, lines }: NewOpeningStock,
): Promise<string> {
  return db.$transaction(async (tx) => {
    const date = await getStartDate(tx);
    if (!date) {
      throw new Refusal(409, "Set the start date before entering opening stock.");
    }
    const party = await lockParty(tx, partyId);
    if (party.type === "supplier") {
      throw new Refusal(409, "A supplier holds no cylinders, so it has no opening stock.");
    }
    if (!party.active) {
      throw new Refusal(409, `${party.name} is inactive. Make it active first.`);
    }
    await refuseUnusableGases(tx, lines);
    const existing = await tx.bill.findFirst({
      where: { ...POSTED_OPENING_STOCK, toPartyId: partyId },
      select: { number: true },
    });
    if (existing) {
      throw new Refusal(
        409,
        `Opening stock has already been entered for ${party.name}, as ${existing.number}.`,
      );
    }
    const bill = await tx.bill.create({
      data: {
        type: "opening_stock",
        number: await issueNumber(tx, "OPN", date),
        date: toDatabaseDate(date),
        toPartyId: partyId,
        enteredById: staff.id,
        enteredAt: clock.now(),
        lines: { create: lines.map((line, index) => ({ ...line, lineNo: index + 1 })) },
      },
      select: { id: true },
    });
    return bill.id;
  });
}

/**
 * The party, held until the transaction ends, so that two saves for one party
 * take turns. Bills can still name it in the meantime.
 */
async function lockParty(tx: Transaction, partyId: string) {
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

/** Refuses lines naming a gas that does not exist or is not offered on anything new. */
async function refuseUnusableGases(tx: Transaction, lines: NewBillLine[]): Promise<void> {
  // An id may arrive in capitals, and still names the same gas.
  const ids = [...new Set(lines.map((line) => line.gasId.toLowerCase()))];
  const gases = await tx.gas.findMany({
    where: { id: { in: ids } },
    select: { name: true, active: true },
  });
  if (gases.length < ids.length) {
    throw noSuchGas();
  }
  const retired = gases.find((gas) => !gas.active);
  if (retired) {
    throw new Refusal(409, `${retired.name} is retired. Bring it back to use it.`);
  }
}

/** The next generated number for a bill of this date, such as OPN-20261101-001. */
async function issueNumber(tx: Transaction, prefix: string, date: string): Promise<string> {
  // The counter's row stays locked until the transaction ends, so that no number
  // is issued twice, and one that is not saved is not used up.
  const [counter] = await tx.$queryRaw<[{ last: number }]>`
    INSERT INTO bill_number_counters (prefix, date, last)
    VALUES (${prefix}, ${date}::date, 1)
    ON CONFLICT (prefix, date) DO UPDATE SET last = bill_number_counters.last + 1
    RETURNING last
  `;
  return `${prefix}-${date.replaceAll("-", "")}-${String(counter.last).padStart(3, "0")}`;
}
