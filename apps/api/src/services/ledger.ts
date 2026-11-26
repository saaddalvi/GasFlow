import {
  PAPER_KIND_NAMES,
  type NewBill,
  type NewBillLine,
  type NewOpeningStock,
  type Staff,
} from "@gasflow/shared";
import type { Clock } from "../clock";
import { isRepeat, type Database, type Transaction } from "../database";
import { toDatabaseDate } from "../database-date";
import { Refusal } from "../refusal";
import { POSTED_OPENING_STOCK } from "./bills";
import { noSuchGas } from "./gases";
import { noSuchParty } from "./parties";
import { getStartDate } from "./setup";
import { getShop } from "./shop";
import { noSuchVehicle } from "./vehicles";

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
      throw inactiveRefusal(party.name);
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
        lines: { create: numbered(lines) },
      },
      select: { id: true },
    });
    return bill.id;
  });
}

/** Who is named on each type of bill entered from paper, beside the shop. */
const NAMED_PARTY = {
  dispatch: { type: "customer", rule: "A dispatch goes to a customer." },
  send_to_refiller: { type: "refiller", rule: "A send to refiller goes to a refiller." },
  return_from_refiller: { type: "refiller", rule: "A return from refiller comes from a refiller." },
} as const;

/**
 * Records a bill entered from paper, moving cylinders between the shop and a
 * customer or refiller, and gives its id. Whoever the cylinders leave may be
 * recorded as holding fewer than are moved.
 */
export function enterBill(
  db: Database,
  clock: Clock,
  staff: Staff,
  bill: NewBill,
): Promise<string> {
  const { type, number, date, vehicleId, notes, lines } = bill;
  const partyId = bill.type === "dispatch" ? bill.customerId : bill.refillerId;
  const named = NAMED_PARTY[type];
  // A return from a refiller is numbered by the refiller's slip, not the agency's paper.
  const paperKind = bill.type === "return_from_refiller" ? null : bill.paperKind;
  const save = db.$transaction(async (tx) => {
    await refuseUnrecordedDate(tx, date);
    const party = await lockParty(tx, partyId);
    if (party.type !== named.type) {
      throw new Refusal(409, `${party.name} is not a ${named.type}. ${named.rule}`);
    }
    if (!party.active) {
      throw inactiveRefusal(party.name);
    }
    if (vehicleId) {
      await refuseUnusableVehicle(tx, vehicleId);
    }
    await refuseUnusableGases(tx, lines);
    const shop = await getShop(tx);
    const [fromPartyId, toPartyId] =
      type === "return_from_refiller" ? [partyId, shop.id] : [shop.id, partyId];
    const saved = await tx.bill.create({
      data: {
        type,
        paperKind,
        number,
        date: toDatabaseDate(date),
        fromPartyId,
        toPartyId,
        vehicleId,
        notes,
        enteredById: staff.id,
        enteredAt: clock.now(),
        lines: { create: numbered(lines) },
      },
      select: { id: true },
    });
    return saved.id;
  });
  return refusingTakenNumber(
    save,
    paperKind
      ? `${PAPER_KIND_NAMES[paperKind]} number ${number} is already in use.`
      : `This refiller's slip number ${number} is already in use.`,
  );
}

/**
 * The database keeps apart the numbers on each paper kind, and each refiller's
 * slip numbers, even between saves at once. A new bill and its lines can repeat
 * nothing else.
 */
async function refusingTakenNumber<T>(save: Promise<T>, refusal: string): Promise<T> {
  try {
    return await save;
  } catch (error) {
    if (isRepeat(error)) {
      throw new Refusal(409, refusal);
    }
    throw error;
  }
}

/** Refuses a date that the records do not cover. */
async function refuseUnrecordedDate(tx: Transaction, date: string): Promise<void> {
  const startDate = await getStartDate(tx);
  if (!startDate) {
    throw new Refusal(409, "An admin has to set the start date before bills are entered.");
  }
  // Cylinders that moved earlier are already in the opening counts.
  if (date < startDate) {
    throw new Refusal(409, "A bill cannot be dated before the start date.");
  }
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

/** Refuses a vehicle that does not exist or is not offered on anything new. */
async function refuseUnusableVehicle(tx: Transaction, vehicleId: string): Promise<void> {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true, active: true },
  });
  if (!vehicle) {
    throw noSuchVehicle();
  }
  if (!vehicle.active) {
    throw inactiveRefusal(vehicle.plate);
  }
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

/** The lines as they are saved, each with its place on the bill. */
function numbered(lines: NewBillLine[]) {
  return lines.map((line, index) => ({ ...line, lineNo: index + 1 }));
}

function inactiveRefusal(name: string): Refusal {
  return new Refusal(409, `${name} is inactive. Make it active first.`);
}
