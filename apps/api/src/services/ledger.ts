import {
  PAPER_KIND_NAMES,
  pendingBillName,
  type NewAllocation,
  type NewBill,
  type NewBillLine,
  type NewOpeningStock,
  type NewReturn,
  type ReceivedReturn,
  type Staff,
} from "@gasflow/shared";
import type { Clock } from "../clock";
import { isRepeat, type Database, type Transaction } from "../database";
import { fromDatabaseDate, toDatabaseDate } from "../database-date";
import { Refusal } from "../refusal";
import { noSuchBill, POSTED_OPENING_STOCK } from "./bills";
import { noSuchGas } from "./gases";
import { noSuchParty } from "./parties";
import { findClearableLines, type ClearableLine } from "./pending";
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

/** Who is named on each type of bill that moves cylinders, beside the shop. */
const NAMED_PARTY = {
  dispatch: { type: "customer", rule: "A dispatch goes to a customer." },
  send_to_refiller: { type: "refiller", rule: "A send to refiller goes to a refiller." },
  return_from_refiller: { type: "refiller", rule: "A return from refiller comes from a refiller." },
  return_from_customer: { type: "customer", rule: "Empties are received from a customer." },
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
    refuseUnusableParty(await lockParty(tx, partyId), named);
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
 * Records cylinders a customer has brought back to the shop, as one return that
 * is matched to the bills they went out on. Gives what its confirmation names.
 */
export function receiveReturn(
  db: Database,
  clock: Clock,
  staff: Staff,
  { customerId, date, slipNumber, allocations }: NewReturn,
): Promise<ReceivedReturn> {
  return db.$transaction(async (tx) => {
    await refuseUnrecordedDate(tx, date);
    const customer = await lockParty(tx, customerId);
    refuseUnusableParty(customer, NAMED_PARTY.return_from_customer);
    // Read after the customer is locked, so that it includes whatever a save just
    // before this one matched.
    const billLines = await findClearableLines(
      tx,
      customerId,
      allocations.map((allocation) => allocation.billId),
    );
    await refuseUnusableAllocations(tx, { id: customerId, name: customer.name }, date, {
      allocations,
      billLines,
    });
    const lines = allocate(billLines, allocations);
    const shop = await getShop(tx);
    const saved = await tx.bill.create({
      data: {
        type: "return_from_customer",
        number: await issueNumber(tx, "RET", date),
        slipNumber,
        date: toDatabaseDate(date),
        fromPartyId: customerId,
        toPartyId: shop.id,
        enteredById: staff.id,
        enteredAt: clock.now(),
        lines: { create: lines },
      },
      select: { id: true, number: true },
    });
    return {
      ...saved,
      customer: { id: customerId, name: customer.name },
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      // Each bill once, in the order its lines came in.
      bills: [
        ...new Map(
          billLines.map(({ billId: id, paperKind, number }) => [id, { id, paperKind, number }]),
        ).values(),
      ],
    };
  });
}

/**
 * Refuses cylinders returned against anything but the customer's own bills dated
 * on or before the return, or more of them than a bill has pending of that gas.
 */
async function refuseUnusableAllocations(
  tx: Transaction,
  customer: { id: string; name: string },
  date: string,
  { allocations, billLines }: { allocations: NewAllocation[]; billLines: ClearableLine[] },
): Promise<void> {
  const bills = await tx.bill.findMany({
    where: { id: { in: allocations.map((allocation) => allocation.billId) } },
    select: { id: true, number: true, date: true },
  });
  /** What has been asked of each bill and gas so far, on the rows before and this one. */
  const asked = new Map<string, number>();
  for (const { billId, gasId, quantity } of allocations) {
    const bill = bills.find((candidate) => candidate.id === billId);
    if (!bill) {
      throw noSuchBill();
    }
    const onBill = billLines.filter((line) => line.billId === billId);
    const [first] = onBill;
    if (!first) {
      throw new Refusal(
        409,
        `${bill.number} is not a dispatch bill or opening stock of ${customer.name}.`,
      );
    }
    const name = pendingBillName(first);
    if (fromDatabaseDate(bill.date) > date) {
      throw new Refusal(409, `${name} is dated after the return.`);
    }
    const ofGas = onBill.filter((line) => line.gasId === gasId);
    const [line] = ofGas;
    if (!line) {
      const gas = await tx.gas.findUnique({ where: { id: gasId }, select: { name: true } });
      throw gas ? new Refusal(409, `${name} has no ${gas.name} on it.`) : noSuchGas();
    }
    const key = `${billId} ${gasId}`;
    const total = (asked.get(key) ?? 0) + quantity;
    asked.set(key, total);
    const pending = ofGas.reduce((sum, other) => sum + other.pending, 0);
    if (total > pending) {
      throw new Refusal(
        409,
        `${name} has ${pending ? `only ${pending}` : "no"} ${line.gasName} pending.`,
      );
    }
  }
}

/**
 * Matches what is being returned to lines of the bills it is returned against,
 * and gives the return's own lines, one for each gas and fill state, each with
 * its allocations.
 */
function allocate(billLines: ClearableLine[], allocations: NewAllocation[]) {
  const pending = new Map(billLines.map((line) => [line.lineId, line.pending]));
  const returned = new Map<string, NewBillLine & { clears: Map<string, number> }>();
  for (const { billId, gasId, fillState, quantity } of allocations) {
    const key = `${gasId} ${fillState}`;
    const line = returned.get(key) ?? { gasId, fillState, quantity: 0, clears: new Map() };
    returned.set(key, line);
    line.quantity += quantity;
    let left = quantity;
    // A bill may have several lines of one gas, which are used up in turn.
    for (const { lineId, ...on } of billLines) {
      if (on.billId === billId && on.gasId === gasId) {
        const used = Math.min(left, pending.get(lineId)!);
        if (used > 0) {
          line.clears.set(lineId, (line.clears.get(lineId) ?? 0) + used);
          pending.set(lineId, pending.get(lineId)! - used);
          left -= used;
        }
      }
    }
  }
  return [...returned.values()].map(({ clears, ...line }, index) => ({
    ...line,
    lineNo: index + 1,
    clears: {
      create: [...clears].map(([clearedLineId, quantity]) => ({ clearedLineId, quantity })),
    },
  }));
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

/** Refuses anyone but an active party of the type that the bill names. */
function refuseUnusableParty(
  party: { name: string; type: string; active: boolean },
  named: (typeof NAMED_PARTY)[keyof typeof NAMED_PARTY],
): void {
  if (party.type !== named.type) {
    throw new Refusal(409, `${party.name} is not a ${named.type}. ${named.rule}`);
  }
  if (!party.active) {
    throw inactiveRefusal(party.name);
  }
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
  return lines.map(({ gasId, fillState, quantity }, index) => ({
    gasId,
    fillState,
    quantity,
    lineNo: index + 1,
  }));
}

function inactiveRefusal(name: string): Refusal {
  return new Refusal(409, `${name} is inactive. Make it active first.`);
}
