import {
  CARD_FIGURES,
  financialYearStart,
  monthsBetween,
  type BillType,
  type StockCard,
  type StockCardBill,
  type StockCardFigures,
  type StockCardQuery,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database } from "../database";
import { fromDatabaseDate } from "../database-date";
import { Refusal } from "../refusal";
import { listGases } from "./gases";
import { MOVEMENTS } from "./holdings";
import { getParty } from "./parties";
import { findMatchesMadeBy, type MatchMade } from "./pending";
import { getStartDate } from "./setup";

/**
 * What went out to one party and came back from it between two dates, month by
 * month, worked out from the posted bills. No count is stored anywhere.
 */
export async function reportStockCard(
  db: Database,
  clock: Clock,
  { partyId, from: first, to = today(clock), full }: StockCardQuery,
): Promise<StockCard> {
  const { id, type, name, active } = await getParty(db, partyId);
  if (type === "supplier") {
    throw new Refusal(409, "A supplier holds no cylinders, so it has no stock card.");
  }
  const startDate = await getStartDate(db);
  if (!full && first && first > to) {
    throw new Refusal(400, "The first date cannot be after the last.");
  }
  // There are no records of a day before the start date.
  const recorded = startDate !== null && to >= startDate;
  const from = firstDate(recorded ? startDate : null, to, { first, full });
  const lines = recorded ? await findLines(db, id, to) : [];
  // The gases are read after the lines, so that every gas on them is among them.
  const gases = await listGases(db, { retired: true });

  const held = new Map<string, number>();
  const hold = ({ gasId, quantity }: Line) => held.set(gasId, (held.get(gasId) ?? 0) + quantity);
  // Opening stock is where a card starts from, even on its own date, the start date.
  const before = lines.filter((line) => line.billType === "opening_stock" || line.date < from);
  const inRange = lines.filter((line) => line.billType !== "opening_stock" && line.date >= from);
  before.forEach(hold);

  const used = new Set(inRange.map((line) => line.gasId));
  for (const [gasId, quantity] of held) {
    if (quantity !== 0) used.add(gasId);
  }
  const shown = gases.filter((gas) => used.has(gas.id)).map(({ id, name }) => ({ id, name }));
  const matched = await findMatchesMadeBy(db, [...new Set(inRange.map((line) => line.billId))]);
  const opening = shown.map((gas) => ({ gas, quantity: held.get(gas.id) ?? 0 }));

  // A month that has not come has nothing to say unless a bill is dated in it, or
  // after it within the range.
  const now = today(clock);
  const lastBill = inRange.at(-1)?.date ?? now;
  const reached = lastBill > now ? lastBill : now;
  const until = reached < to ? reached : to;
  const byMonth = grouped(inRange, (line) => line.date.slice(0, 7));
  const months = (recorded ? monthsBetween(from, until) : []).map((month) => {
    const ofMonth = byMonth.get(month) ?? [];
    ofMonth.forEach(hold);
    const bills = [...grouped(ofMonth, (line) => line.billId).values()].map((ofBill) =>
      asBill(ofBill, shown, matched),
    );
    return { month, gases: figuresOf(shown, ofMonth, held), bills };
  });

  return {
    // Only customers and refillers have a card.
    party: { id, name, active, type: type as StockCard["party"]["type"] },
    startDate,
    from,
    to,
    gases: shown,
    opening,
    months,
    closing: figuresOf(shown, inRange, held),
  };
}

/**
 * The first date of the card: the one asked for, or else 1 April of the last one's
 * financial year. A card of the full history begins where the records do, and none
 * begins before them. The start date is null if no record is within the range.
 */
function firstDate(
  startDate: string | null,
  to: string,
  { first, full }: { first?: string; full: boolean },
): string {
  if (full) {
    return startDate ?? financialYearStart(to);
  }
  const wanted = first ?? financialYearStart(to);
  return startDate && wanted < startDate ? startDate : wanted;
}

/** The items under each key, the keys and the items in the order they come. */
function grouped<Item>(items: Item[], keyOf: (item: Item) => string): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    groups.set(key, group);
    group.push(item);
  }
  return groups;
}

/** Each gas's figures over these lines, with what was held after them. */
function figuresOf(
  gases: StockCard["gases"],
  lines: Line[],
  held: ReadonlyMap<string, number>,
): StockCardFigures[] {
  return gases.map((gas) => {
    const figures = { gas, sent: 0, returned: 0, writtenOff: 0, holding: held.get(gas.id) ?? 0 };
    for (const line of lines) {
      const figure = CARD_FIGURES[line.billType];
      if (line.gasId === gas.id && figure) {
        figures[figure] += Math.abs(line.quantity);
      }
    }
    return figures;
  });
}

/** A bill as the card lists it, from its lines. */
function asBill(lines: Line[], gases: StockCard["gases"], matched: MatchMade[]): StockCardBill {
  // There is a bill only where there are lines.
  const { billId, billType, paperKind, number, date, writeOffReason } = lines[0]!;
  return {
    id: billId,
    type: billType,
    paperKind,
    number,
    date,
    writeOffReason,
    gases: gases.flatMap((gas) => {
      const ofGas = lines.filter((line) => line.gasId === gas.id);
      if (ofGas.length === 0) {
        return [];
      }
      const quantity = ofGas.reduce((sum, line) => sum + Math.abs(line.quantity), 0);
      const against = matched
        .filter((part) => part.clearingBillId === billId && part.gasId === gas.id)
        .map(({ billId: id, type, paperKind, number, quantity }) => ({
          bill: { id, type, paperKind, number },
          quantity,
        }));
      // Only a return from a customer can bring back more than is matched.
      const unmatched =
        billType === "return_from_customer"
          ? quantity - against.reduce((sum, part) => sum + part.quantity, 0)
          : 0;
      return [{ gas, quantity, against, unmatched }];
    }),
  };
}

/** One line of a posted bill that names the party. */
interface Line {
  billId: string;
  billType: BillType;
  paperKind: StockCardBill["paperKind"];
  number: string;
  date: string;
  writeOffReason: StockCardBill["writeOffReason"];
  gasId: string;
  /** What it brought to the party, so below zero when it took from it. */
  quantity: number;
}

/**
 * The lines of the party's posted bills dated no later than the date: the oldest
 * bill first, those of one date in the order they were entered, and each bill's
 * lines together.
 */
async function findLines(db: Database, partyId: string, to: string): Promise<Line[]> {
  const rows = await db.$queryRaw<(Omit<Line, "date"> & { date: Date })[]>`
    SELECT b.id AS "billId", b.type::text AS "billType", b.paper_kind::text AS "paperKind",
           b.number::text AS number, b.date, b.write_off_reason::text AS "writeOffReason",
           m.gas_id AS "gasId", m.quantity
      FROM (${MOVEMENTS}) m
      JOIN bills b ON b.id = m.bill_id
     WHERE m.party_id = ${partyId}::uuid AND m.date <= ${to}::date
     ORDER BY b.date, b.entered_at, b.id, m.line_no
  `;
  return rows.map((row) => ({ ...row, date: fromDatabaseDate(row.date) }));
}
