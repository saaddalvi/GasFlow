import {
  FILL_STATES,
  type DayLedger,
  type DayLedgerCounts,
  type DayLedgerTable,
  type FillState,
  type Gas,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database } from "../database";
import { Prisma } from "../generated/prisma/client";
import { listGases } from "./gases";
import { MOVEMENTS } from "./holdings";
import { getStartDate } from "./setup";

/**
 * What the shop opened a day with, what came in and went out, and what it closed
 * with, by fill state and gas, worked out from the posted bills. No count is
 * stored anywhere.
 */
export async function reportDayLedger(
  db: Database,
  clock: Clock,
  date: string = today(clock),
): Promise<DayLedger> {
  const startDate = await getStartDate(db);
  if (!startDate || date < startDate) {
    return { date, startDate, tables: [] };
  }
  // The gases are read after the counts, so that every counted gas is among
  // them, even one added and used in the meantime.
  const counted = (await countShopDay(db, date)).filter(hasCylinders);
  const gases = await listGases(db, { retired: true });
  // A retired gas is of interest only on days the shop has or moves some. Every
  // table has the same gases.
  const used = new Set(counted.map((count) => count.gasId));
  const shown = gases.filter((gas) => gas.active || used.has(gas.id));
  // Most agencies have no defective cylinders on most days.
  const fillStates = FILL_STATES.filter(
    (fillState) =>
      fillState !== "defective" || counted.some((count) => count.fillState === fillState),
  );
  return {
    date,
    startDate,
    tables: fillStates.map((fillState) => tableOf(fillState, shown, counted)),
  };
}

/** One gas and fill state's part of the shop's day, as the bills have it. */
type ShopCount = Omit<DayLedgerCounts, "closing"> & { gasId: string; fillState: FillState };

const NOTHING = { opening: 0, in: 0, out: 0 };

function hasCylinders({ opening, in: cameIn, out }: ShopCount): boolean {
  return [opening, cameIn, out].some((count) => count !== 0);
}

function tableOf(fillState: FillState, gases: Gas[], counted: ShopCount[]): DayLedgerTable {
  const columns = gases.map(({ id, name }) => {
    const found = counted.find((count) => count.gasId === id && count.fillState === fillState);
    const { opening, in: cameIn, out } = found ?? NOTHING;
    return { gas: { id, name }, opening, in: cameIn, out, closing: opening + cameIn - out };
  });
  const sum = (count: keyof DayLedgerCounts) =>
    columns.reduce((total, column) => total + column[count], 0);
  return {
    fillState,
    gases: columns,
    total: { opening: sum("opening"), in: sum("in"), out: sum("out"), closing: sum("closing") },
  };
}

/**
 * What the shop had as the day began, and what the day's bills brought and took.
 * Opening stock is where the shop starts from rather than something that comes
 * in, so it is part of the opening even on its own date, the start date.
 */
function countShopDay(db: Database, date: string): Promise<ShopCount[]> {
  const inOpening = Prisma.sql`(m.date < ${date}::date OR m.bill_type = 'opening_stock')`;
  return db.$queryRaw<ShopCount[]>`
    SELECT m.gas_id AS "gasId",
           m.fill_state::text AS "fillState",
           COALESCE(SUM(m.quantity) FILTER (WHERE ${inOpening}), 0)::int AS opening,
           COALESCE(SUM(m.quantity)
             FILTER (WHERE NOT ${inOpening} AND m.quantity > 0), 0)::int AS "in",
           COALESCE(-SUM(m.quantity)
             FILTER (WHERE NOT ${inOpening} AND m.quantity < 0), 0)::int AS out
      FROM (${MOVEMENTS}) m
      JOIN parties p ON p.id = m.party_id AND p.type = 'shop'
     WHERE m.date <= ${date}::date
     GROUP BY m.gas_id, m.fill_state
  `;
}
