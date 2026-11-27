import {
  HOLDER_TYPES,
  type FillState,
  type HolderType,
  type StockReport,
  type StockReportRow,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database, Transaction } from "../database";
import { Prisma } from "../generated/prisma/client";
import { listGases } from "./gases";
import { MOVEMENTS } from "./holdings";
import { getStartDate } from "./setup";

/**
 * Where the cylinders of each gas were at the end of a day, worked out from the
 * posted bills. No count is stored anywhere.
 */
export async function reportStock(
  db: Database,
  clock: Clock,
  date: string = today(clock),
): Promise<StockReport> {
  const startDate = await getStartDate(db);
  if (!startDate || date < startDate) {
    return { date, startDate, rows: [] };
  }
  return { date, startDate, rows: await findStockRows(db, date) };
}

/**
 * Where the cylinders of each gas were at the end of the date, or where every
 * posted bill leaves them if none is given: one row for each gas in use, and for
 * each retired one that is still of interest, which by default means that there
 * are cylinders of it anywhere.
 */
export async function findStockRows(
  db: Database | Transaction,
  date?: string,
  ofInterest: (row: StockReportRow) => boolean = hasCylinders,
): Promise<StockReportRow[]> {
  // The gases are read after the counts, so that every counted gas is among
  // them, even one added and used in the meantime.
  const counts = await countCylinders(db, date);
  const gases = await listGases(db, { retired: true });
  const rows = new Map<string, StockReportRow>(
    gases.map(({ id, name }) => [id, emptyRow({ id, name })]),
  );
  for (const { gasId, holder, fillState, quantity } of counts) {
    // Every line names a gas, and gases are never deleted.
    const row = rows.get(gasId)!;
    if (holder === "shop") {
      row.shop[fillState] += quantity;
    } else {
      // Fill state counts only for the shop.
      row[holder === "customer" ? "customers" : "refillers"] += quantity;
    }
    row.total += quantity;
  }
  const retired = new Set(gases.filter((gas) => !gas.active).map((gas) => gas.id));
  return [...rows.values()].filter((row) => !retired.has(row.gas.id) || ofInterest(row));
}

interface Count {
  gasId: string;
  holder: HolderType;
  fillState: FillState;
  quantity: number;
}

/**
 * What the shop, customers and refillers had at the end of the day, or counting
 * every posted bill if none is given: each gains what posted bills bring to it
 * and loses what they take away. Suppliers and the world outside the business
 * hold nothing that is counted.
 */
function countCylinders(db: Database | Transaction, date?: string): Promise<Count[]> {
  return db.$queryRaw<Count[]>`
    SELECT m.gas_id AS "gasId",
           p.type::text AS holder,
           m.fill_state::text AS "fillState",
           SUM(m.quantity)::int AS quantity
      FROM (${MOVEMENTS}) m JOIN parties p ON p.id = m.party_id
     WHERE m.date <= COALESCE(${date ?? null}::date, m.date) AND p.type::text IN (${Prisma.join([...HOLDER_TYPES])})
     GROUP BY m.gas_id, p.type, m.fill_state
  `;
}

function emptyRow(gas: StockReportRow["gas"]): StockReportRow {
  return { gas, shop: { filled: 0, empty: 0, defective: 0 }, customers: 0, refillers: 0, total: 0 };
}

/** Whether the shop has any of the gas, or fewer than none, in any fill state. */
export function hasAtShop({ shop }: StockReportRow): boolean {
  return Object.values(shop).some((count) => count !== 0);
}

function hasCylinders(row: StockReportRow): boolean {
  return hasAtShop(row) || row.customers !== 0 || row.refillers !== 0;
}
