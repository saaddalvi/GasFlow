import {
  billName,
  PAPER_KIND_NAMES,
  pendingBillName,
  whyNotCancel,
  whyNotCorrect,
  whyUncorrectable,
  type BillContent,
  type BillCorrection,
  type BlockingBill,
  type Matched,
  type NewAllocation,
  type NewBill,
  type NewBillLine,
  type NewCancellation,
  type NewMatch,
  type NewOpeningStock,
  type NewReturn,
  type NewUnmatched,
  type ReceivedReturn,
  type Staff,
} from "@gasflow/shared";
import { isDeepStrictEqual } from "node:util";
import { today, type Clock } from "../clock";
import { isRepeat, type Database, type Transaction } from "../database";
import { fromDatabaseDate, toDatabaseDate } from "../database-date";
import { BlockedRefusal, Refusal } from "../refusal";
import { noSuchBill, POSTED_OPENING_STOCK, readContent } from "./bills";
import { noSuchGas } from "./gases";
import { noSuchParty } from "./parties";
import {
  findAllocationsToBill,
  findClearableLines,
  findPendingRows,
  type AllocationToBill,
  type ClearableLine,
} from "./pending";
import { getStartDate } from "./setup";
import { getShop } from "./shop";
import { findUnmatchedLines, noSuchReturn } from "./unmatched";
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
  const { partyId, named, paperKind, takenNumber } = paperDetails(bill);
  const save = db.$transaction(async (tx) => {
    await refuseUnrecordedDate(tx, date);
    refuseUnusableParty(await lockParty(tx, partyId), named);
    if (vehicleId) {
      await refuseUnusableVehicle(tx, vehicleId);
    }
    await refuseUnusableGases(tx, lines);
    const saved = await tx.bill.create({
      data: {
        type,
        paperKind,
        number,
        date: toDatabaseDate(date),
        ...sides(type, partyId, (await getShop(tx)).id),
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
  return refusingTakenNumber(save, takenNumber);
}

/**
 * Changes a posted bill to what the correction says, so that every figure follows
 * it, and keeps what it said before. What it may newly name is limited as on a new
 * bill, but whatever it already names may stay, even if since made inactive or
 * retired. It may not come to contradict the returns matched to it.
 */
export function correctBill(
  db: Database,
  clock: Clock,
  staff: Staff,
  billId: string,
  correction: BillCorrection,
): Promise<void> {
  // Opening stock is corrected in its lines alone.
  const paper =
    correction.type === "opening_stock" ? null : { ...correction, ...paperDetails(correction) };
  const save = db.$transaction(async (tx) => {
    const bill = await lockBill(tx, billId);
    const uncorrectable = whyUncorrectable(bill);
    if (uncorrectable) {
      throw new Refusal(409, uncorrectable);
    }
    const notAllowed = whyNotCorrect(bill, staff, today(clock));
    if (notAllowed) {
      throw new Refusal(403, notAllowed);
    }
    if (correction.type !== bill.type) {
      throw new Refusal(409, "The type of a bill cannot be changed. Cancel it and enter it again.");
    }
    const shop = await getShop(tx);
    const namedBefore = partyConcerned(bill, shop.id);
    const partyId = paper?.partyId ?? namedBefore;
    // The party it names now and the one it is to name, as returns may be matched
    // to it by either of them in the meantime.
    const parties = await lockParties(tx, [namedBefore, partyId]);
    if (paper) {
      await refuseUnrecordedDate(tx, paper.date);
      if (partyId !== namedBefore) {
        refuseUnusableParty(parties.get(partyId)!, paper.named);
      }
      if (paper.vehicleId && paper.vehicleId !== bill.vehicleId) {
        await refuseUnusableVehicle(tx, paper.vehicleId);
      }
    }
    const gasesOnBill = new Set(bill.lines.map((line) => line.gasId));
    await refuseUnusableGases(
      tx,
      correction.lines.filter((line) => !gasesOnBill.has(line.gasId)),
    );
    // What is matched to the bill changes only while its party's lock is held, so
    // it is read after.
    const matched = await findAllocationsToBill(tx, billId);
    refuseContradictingReturns(pendingBillName(bill), matched, {
      changesParty: partyId !== namedBefore,
      date: paper?.date,
      lines: correction.lines,
    });
    const earlier = await readContent(tx, billId);
    if (paper) {
      const { type, paperKind, number, date, vehicleId, notes } = paper;
      await tx.bill.update({
        where: { id: billId },
        data: {
          paperKind,
          number,
          date: toDatabaseDate(date),
          ...sides(type, partyId, shop.id),
          vehicleId,
          notes,
        },
      });
    }
    await replaceLines(tx, billId, correction.lines, matched);
    // A correction that changes nothing leaves nothing to keep.
    if (!isDeepStrictEqual(await readContent(tx, billId), earlier)) {
      await keepVersion(tx, clock, staff, billId, earlier);
    }
  });
  return paper ? refusingTakenNumber(save, paper.takenNumber) : save;
}

/**
 * Refuses a correction that would leave a bill contradicting the returns matched to
 * it, saying all that is wrong and naming each return in the way.
 */
function refuseContradictingReturns(
  name: string,
  matched: AllocationToBill[],
  {
    changesParty,
    date,
    lines,
  }: {
    changesParty: boolean;
    /** Left out when the correction cannot change it. */
    date?: string;
    lines: NewBillLine[];
  },
): void {
  if (matched.length === 0) {
    return;
  }
  // Only a customer's bills have anything matched to them.
  if (changesParty) {
    throw new BlockedRefusal(
      `${name} has returns matched to it, so its customer cannot be changed. ` +
        "Cancel those returns first.",
      returnsAmong(matched),
    );
  }
  const problems: string[] = [];
  const inTheWay = new Set<AllocationToBill>();
  for (const gasId of new Set(matched.map((allocation) => allocation.gasId))) {
    const ofGas = matched.filter((allocation) => allocation.gasId === gasId);
    const returned = totalOf(ofGas);
    if (totalOf(lines.filter((line) => line.gasId === gasId)) < returned) {
      problems.push(
        `${name} cannot have fewer than the ${returned} ${ofGas[0]!.gasName} returned against it.`,
      );
      ofGas.forEach((allocation) => inTheWay.add(allocation));
    }
  }
  const earlier = matched.filter(
    (allocation) => date && fromDatabaseDate(allocation.returnDate) < date,
  );
  if (earlier.length > 0) {
    problems.push(`${name} cannot be dated after cylinders were returned against it.`);
    earlier.forEach((allocation) => inTheWay.add(allocation));
  }
  if (problems.length > 0) {
    throw new BlockedRefusal(
      `${problems.join(" ")} Cancel the returns in the way first, or change the correction.`,
      // As ordered among everything matched, the oldest first.
      returnsAmong(matched.filter((allocation) => inTheWay.has(allocation))),
    );
  }
}

/** The returns that these are parts of, each once, in the order they come. */
function returnsAmong(matched: AllocationToBill[]): BlockingBill[] {
  return [
    ...new Map(
      matched.map(({ returnId: id, returnNumber: number }) => [id, { id, number }]),
    ).values(),
  ];
}

/**
 * Gives a bill the lines it is corrected to. A saved line carries on as one of them
 * while one of its gas is left, those with returns matched to them before the
 * rest. What is matched to a line stays on it as far as it still fits, and
 * otherwise moves to other lines of its gas.
 */
async function replaceLines(
  tx: Transaction,
  billId: string,
  lines: NewBillLine[],
  matched: AllocationToBill[],
): Promise<void> {
  const before = await tx.billLine.findMany({
    where: { billId },
    select: { id: true, gasId: true, fillState: true, quantity: true },
    orderBy: { lineNo: "asc" },
  });
  const kept = pairLines(before, lines, new Set(matched.map((part) => part.clearedLineId)));
  // Out of the way, so that no two lines are ever in one place.
  await tx.$executeRaw`UPDATE bill_lines SET line_no = -line_no WHERE bill_id = ${billId}::uuid`;
  const after: { id: string; gasId: string; quantity: number }[] = [];
  for (const [index, line] of numbered(lines).entries()) {
    const id = kept[index];
    const select = { id: true, gasId: true, quantity: true };
    after.push(
      id
        ? await tx.billLine.update({ where: { id }, data: line, select })
        : await tx.billLine.create({ data: { ...line, billId }, select }),
    );
  }
  await moveAllocations(tx, after, matched);
  const dropped = before.map((line) => line.id).filter((id) => !kept.includes(id));
  // All that can still point at these is what cancelled returns had matched, which
  // counts for nothing.
  await tx.allocation.deleteMany({ where: { clearedLineId: { in: dropped } } });
  await tx.billLine.deleteMany({ where: { id: { in: dropped } } });
}

/**
 * For each of the lines a bill is corrected to, the saved line that carries on as
 * it, if any. As many saved lines of a gas carry on as the correction has lines of
 * it, those with returns matched to them before the rest, and each as the line
 * most like it, in its own place if it can.
 */
function pairLines(
  before: (NewBillLine & { id: string })[],
  lines: NewBillLine[],
  returnedAgainst: Set<string>,
): (string | undefined)[] {
  const unclaimed = new Map<string, number>();
  for (const { gasId } of lines) {
    unclaimed.set(gasId, (unclaimed.get(gasId) ?? 0) + 1);
  }
  const returnsFirst = [...before.entries()].sort(
    ([, one], [, other]) =>
      Number(returnedAgainst.has(other.id)) - Number(returnedAgainst.has(one.id)),
  );
  const carrying = returnsFirst.filter(([, { gasId }]) => {
    const left = unclaimed.get(gasId) ?? 0;
    unclaimed.set(gasId, left - 1);
    return left > 0;
  });

  type Alike = (saved: NewBillLine, line: NewBillLine) => boolean;
  const sameGas: Alike = (saved, line) => saved.gasId === line.gasId;
  const sameFill: Alike = (saved, line) =>
    sameGas(saved, line) && saved.fillState === line.fillState;
  const unchanged: Alike = (saved, line) =>
    sameFill(saved, line) && saved.quantity === line.quantity;
  const kept = lines.map((): string | undefined => undefined);
  // All of them try for each likeness before any settles for less.
  for (const alike of [unchanged, sameFill, sameGas]) {
    for (const inPlace of [true, false]) {
      for (const [place, saved] of carrying) {
        if (kept.includes(saved.id)) continue;
        const index = lines.findIndex(
          (line, at) => !kept[at] && (!inPlace || at === place) && alike(saved, line),
        );
        if (index >= 0) kept[index] = saved.id;
      }
    }
  }
  return kept;
}

/** Takes off each line whatever is matched to it beyond its quantity, and puts it on others. */
async function moveAllocations(
  tx: Transaction,
  lines: { id: string; gasId: string; quantity: number }[],
  matched: AllocationToBill[],
): Promise<void> {
  const free = lines.map(({ id, gasId, quantity }) => ({ lineId: id, gasId, left: quantity }));
  const moving: AllocationToBill[] = [];
  for (const allocation of matched) {
    const { clearingLineId, clearedLineId, quantity } = allocation;
    const line = free.find((other) => other.lineId === clearedLineId);
    const stays = Math.min(quantity, line?.left ?? 0);
    if (line) line.left -= stays;
    if (stays === quantity) continue;
    const where = { clearingLineId_clearedLineId: { clearingLineId, clearedLineId } };
    if (stays > 0) {
      await tx.allocation.update({ where, data: { quantity: stays } });
    } else {
      await tx.allocation.delete({ where });
    }
    moving.push({ ...allocation, quantity: quantity - stays });
  }
  // Only once everything staying put has its room.
  for (const { clearingLineId, gasId, quantity } of moving) {
    const ofGas = free.filter((line) => line.gasId === gasId);
    for (const to of takeInTurn(ofGas, quantity)) {
      await addAllocation(tx, { clearingLineId, clearedLineId: to.lineId }, to.quantity);
    }
  }
}

/** Matches more of a return's line to a bill's line, which it may be matched to already. */
async function addAllocation(
  tx: Transaction,
  pair: { clearingLineId: string; clearedLineId: string },
  quantity: number,
): Promise<void> {
  await tx.allocation.upsert({
    where: { clearingLineId_clearedLineId: pair },
    create: { ...pair, quantity },
    update: { quantity: { increment: quantity } },
  });
}

/** Keeps what the bill said before this correction as its latest earlier version. */
async function keepVersion(
  tx: Transaction,
  clock: Clock,
  staff: Staff,
  billId: string,
  content: BillContent,
): Promise<void> {
  // The bill is locked, so no other correction can take the same version.
  const kept = await tx.billRevision.count({ where: { billId } });
  await tx.billRevision.create({
    data: {
      billId,
      version: kept + 1,
      content,
      replacedById: staff.id,
      replacedAt: clock.now(),
    },
  });
}

/** What follows from the type of a bill copied from paper, on entry and on correction. */
function paperDetails(bill: NewBill) {
  // A return from a refiller is numbered by the refiller's slip, not the agency's paper.
  const paperKind = bill.type === "return_from_refiller" ? null : bill.paperKind;
  return {
    partyId: bill.type === "dispatch" ? bill.customerId : bill.refillerId,
    named: NAMED_PARTY[bill.type],
    paperKind,
    /** What to say if another bill turns out to have the number. */
    takenNumber: paperKind
      ? `${PAPER_KIND_NAMES[paperKind]} number ${bill.number} is already in use.`
      : `This refiller's slip number ${bill.number} is already in use.`,
  };
}

/** Which of the shop and the party the cylinders leave, and which receives them. */
function sides(type: NewBill["type"], partyId: string, shopId: string) {
  const [fromPartyId, toPartyId] =
    type === "return_from_refiller" ? [partyId, shopId] : [shopId, partyId];
  return { fromPartyId, toPartyId };
}

/**
 * Records cylinders a customer has brought back to the shop, as one return that
 * is matched to the bills they went out on. Those beyond everything pending are
 * left unmatched. Gives what its confirmation names.
 */
export function receiveReturn(
  db: Database,
  clock: Clock,
  staff: Staff,
  { customerId, date, slipNumber, allocations, unmatched }: NewReturn,
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
    await refuseUnusableGases(tx, unmatched);
    await refuseUnmatchedWhilePending(tx, { id: customerId, name: customer.name }, date, {
      allocations,
      unmatched,
    });
    const lines = returnLines(billLines, allocations, unmatched);
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
      quantity: totalOf(lines),
      unmatched: totalOf(unmatched),
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
 * Matches some of a return's unmatched cylinders of one gas to a dispatch bill or
 * opening stock, and says how many of the gas the return still has unmatched.
 * The return's own lines stay as they were saved.
 */
export function matchUnmatched(db: Database, returnId: string, match: NewMatch): Promise<Matched> {
  const { billId, gasId, quantity } = match;
  return db.$transaction(async (tx) => {
    const returnBill = await tx.bill.findUnique({
      where: { id: returnId, type: "return_from_customer" },
      select: { number: true, date: true, fromPartyId: true },
    });
    if (!returnBill) {
      throw noSuchReturn();
    }
    // Every return names the customer it came from, which never changes.
    const customerId = returnBill.fromPartyId!;
    const customer = await lockParty(tx, customerId);
    // Both sides are read after the customer is locked, so that they include
    // whatever a save just before this one matched or cancelled.
    const { status } = await tx.bill.findUniqueOrThrow({
      where: { id: returnId },
      select: { status: true },
    });
    if (status === "cancelled") {
      throw new Refusal(409, `${returnBill.number} has been cancelled.`);
    }
    const billLines = await findClearableLines(tx, customerId, [billId]);
    await refuseUnusableAllocations(
      tx,
      { id: customerId, name: customer.name },
      fromDatabaseDate(returnBill.date),
      { allocations: [match], billLines },
    );
    const unmatchedLines = await findUnmatchedLines(tx, returnId, gasId);
    const unmatched = unmatchedLines.reduce((sum, line) => sum + line.unmatched, 0);
    const ofGas = billLines.filter((line) => line.gasId === gasId);
    if (quantity > unmatched) {
      // The bill was found to have the gas, so one of its lines names it.
      const { gasName } = ofGas[0]!;
      throw new Refusal(
        409,
        `${returnBill.number} has ${unmatched ? `only ${unmatched}` : "no"} ${gasName} unmatched.`,
      );
    }
    const cleared = ofGas.map(({ lineId, pending }) => ({ lineId, left: pending }));
    const clearing = unmatchedLines.map(({ lineId, unmatched }) => ({ lineId, left: unmatched }));
    for (const from of takeInTurn(clearing, quantity)) {
      for (const to of takeInTurn(cleared, from.quantity)) {
        const pair = { clearingLineId: from.lineId, clearedLineId: to.lineId };
        await addAllocation(tx, pair, to.quantity);
      }
    }
    return { unmatched: unmatched - quantity };
  });
}

/**
 * Cancels a bill for good, so that it no longer counts towards any figure. It
 * stays, saying who cancelled it, when and why, and its number is free again.
 */
export function cancelBill(
  db: Database,
  clock: Clock,
  staff: Staff,
  billId: string,
  { reason, notes }: NewCancellation,
): Promise<void> {
  return db.$transaction(async (tx) => {
    const bill = await lockBill(tx, billId);
    const notAllowed = whyNotCancel(bill, staff, today(clock));
    if (notAllowed) {
      throw new Refusal(403, notAllowed);
    }
    if (bill.status === "cancelled") {
      throw new Refusal(409, "This bill has already been cancelled.");
    }
    // What is matched to the bill changes only while this lock is held, so it is
    // read after.
    await lockParty(tx, partyConcerned(bill, (await getShop(tx)).id));
    await refuseWhileReturnedAgainst(tx, billId, bill);
    await tx.bill.update({
      where: { id: billId },
      data: {
        status: "cancelled",
        cancelReason: reason,
        cancelNotes: notes,
        cancelledById: staff.id,
        cancelledAt: clock.now(),
      },
    });
  });
}

/**
 * Refuses to cancel a dispatch bill or opening stock that posted returns are
 * matched to, naming each of them, the oldest first.
 */
async function refuseWhileReturnedAgainst(
  tx: Transaction,
  billId: string,
  bill: Parameters<typeof pendingBillName>[0],
): Promise<void> {
  const matched = await findAllocationsToBill(tx, billId);
  if (matched.length > 0) {
    // Only dispatch bills and opening stock have anything matched to them.
    throw new BlockedRefusal(
      `${pendingBillName(bill)} has returns matched to it. Cancel those first.`,
      returnsAmong(matched),
    );
  }
}

/**
 * The bill, held until the transaction ends, so that two changes to one bill take
 * turns. Nothing else changes a saved bill's row or lines, so they stay as read
 * here. Whom it names can be changed, so it is locked before its party is.
 */
async function lockBill(tx: Transaction, billId: string) {
  await tx.$queryRaw`SELECT 1 FROM bills WHERE id = ${billId}::uuid FOR NO KEY UPDATE`;
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    select: {
      type: true,
      paperKind: true,
      number: true,
      status: true,
      fromPartyId: true,
      toPartyId: true,
      vehicleId: true,
      // The one relation read, since a transaction's one connection cannot run
      // the queries for several side by side.
      lines: { select: { gasId: true } },
      enteredById: true,
      enteredAt: true,
    },
  });
  if (!bill) {
    throw noSuchBill();
  }
  return { ...bill, enteredBy: { id: bill.enteredById } };
}

/**
 * Whom changes touching a bill take turns by: the party named on it beside the
 * shop, or the shop itself on its own opening stock.
 */
function partyConcerned(
  { fromPartyId, toPartyId }: { fromPartyId: string | null; toPartyId: string | null },
  shopId: string,
): string {
  return [fromPartyId, toPartyId].find((id) => id !== null && id !== shopId) ?? shopId;
}

/**
 * Refuses cylinders returned against anything but the customer's own bills dated
 * on or before the return, or more of them than a bill has pending of that gas.
 */
async function refuseUnusableAllocations(
  tx: Transaction,
  customer: { id: string; name: string },
  date: string,
  {
    allocations,
    billLines,
  }: {
    allocations: Pick<NewAllocation, "billId" | "gasId" | "quantity">[];
    billLines: ClearableLine[];
  },
): Promise<void> {
  const bills = await tx.bill.findMany({
    where: { id: { in: allocations.map((allocation) => allocation.billId) } },
    select: { id: true, type: true, paperKind: true, number: true, date: true, status: true },
  });
  /** What has been asked of each bill and gas so far, on the rows before and this one. */
  const asked = new Map<string, number>();
  for (const { billId, gasId, quantity } of allocations) {
    const bill = bills.find((candidate) => candidate.id === billId);
    if (!bill) {
      throw noSuchBill();
    }
    // As when a colleague cancels it while it is on screen.
    if (bill.status === "cancelled") {
      // Opening stock goes by that, as on the rows it is returned against.
      const name = bill.type === "opening_stock" ? pendingBillName(bill) : billName(bill);
      throw new Refusal(409, `${name} has been cancelled.`);
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
 * Refuses cylinders left unmatched while the customer has any of their gas still
 * pending on a bill dated on or before the return, once the return's own
 * allocations are taken off.
 */
async function refuseUnmatchedWhilePending(
  tx: Transaction,
  customer: { id: string; name: string },
  date: string,
  { allocations, unmatched }: Pick<NewReturn, "allocations" | "unmatched">,
): Promise<void> {
  if (unmatched.length === 0) {
    return;
  }
  const rows = await findPendingRows(tx, customer.id, date);
  for (const { gasId } of unmatched) {
    const ofGas = rows.filter((row) => row.gas.id === gasId);
    const [row] = ofGas;
    if (!row) {
      continue;
    }
    const left =
      ofGas.reduce((sum, other) => sum + other.pending, 0) -
      totalOf(allocations.filter((allocation) => allocation.gasId === gasId));
    if (left > 0) {
      throw new Refusal(
        409,
        `${customer.name} still has ${left} ${row.gas.name} pending on this date. ` +
          "Return those against their bills before leaving any unmatched.",
      );
    }
  }
}

/**
 * Matches what is being returned to lines of the bills it is returned against,
 * and gives the return's own lines, one for each gas and fill state, each with
 * its allocations. A line holds its unmatched cylinders too, as the part of its
 * quantity that no allocation covers.
 */
function returnLines(
  billLines: ClearableLine[],
  allocations: NewAllocation[],
  unmatched: NewUnmatched[],
) {
  const cleared = billLines.map((line) => ({ ...line, left: line.pending }));
  const returned = new Map<string, NewBillLine & { clears: Map<string, number> }>();
  /** Puts the cylinders on the line of their gas and fill state, and gives that line. */
  function add({ gasId, fillState, quantity }: NewBillLine) {
    const key = `${gasId} ${fillState}`;
    const line = returned.get(key) ?? { gasId, fillState, quantity: 0, clears: new Map() };
    returned.set(key, line);
    line.quantity += quantity;
    return line;
  }
  for (const { billId, gasId, fillState, quantity } of allocations) {
    const line = add({ gasId, fillState, quantity });
    // A bill may have several lines of one gas.
    const onBill = cleared.filter((other) => other.billId === billId && other.gasId === gasId);
    for (const { lineId, quantity: used } of takeInTurn(onBill, quantity)) {
      line.clears.set(lineId, (line.clears.get(lineId) ?? 0) + used);
    }
  }
  unmatched.forEach(add);
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
 * slip numbers, even between saves at once. Saving a bill copied from paper, new
 * or corrected, can repeat nothing else.
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

/**
 * The parties, each held as lockParty holds one. They are taken in the order of
 * their ids, so that two changes needing the same two cannot hold one each.
 */
async function lockParties(tx: Transaction, partyIds: string[]) {
  const parties = new Map<string, Awaited<ReturnType<typeof lockParty>>>();
  for (const partyId of [...new Set(partyIds)].sort()) {
    parties.set(partyId, await lockParty(tx, partyId));
  }
  return parties;
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
  const ids = [...new Set(lines.map((line) => line.gasId))];
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

/**
 * Takes the quantity from the lines in turn, lowering what each has left, and
 * says how much came from each.
 */
function takeInTurn(lines: { lineId: string; left: number }[], quantity: number) {
  const taken: { lineId: string; quantity: number }[] = [];
  for (const line of lines) {
    const used = Math.min(quantity, line.left);
    if (used > 0) {
      line.left -= used;
      quantity -= used;
      taken.push({ lineId: line.lineId, quantity: used });
    }
  }
  return taken;
}

/** The cylinders on all these together. */
function totalOf(rows: { quantity: number }[]): number {
  return rows.reduce((sum, row) => sum + row.quantity, 0);
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
