import {
  HOLDER_TYPES,
  type FillState,
  type HolderType,
  type StockReport,
  type StockReportRow,
} from "@gasflow/shared";
import { today, type Clock } from "../clock";
import type { Database } from "../database";
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
  // A retired gas is of interest only while there are cylinders of it.
  const retired = new Set(gases.filter((gas) => !gas.active).map((gas) => gas.id));
  return {
    date,
    startDate,
    rows: [...rows.values()].filter((row) => !retired.has(row.gas.id) || hasCylinders(row)),
  };
}

interface Count {
  gasId: string;
  holder: HolderType;
  fillState: FillState;
  quantity: number;
}

/**
 * What the shop, customers and refillers had at the end of the day: each gains
 * what posted bills bring to it and loses what they take away. Suppliers and the
 * world outside the business hold nothing that is counted.
 */
function countCylinders(db: Database, date: string): Promise<Count[]> {
  return db.$queryRaw<Count[]>`
    SELECT m.gas_id AS "gasId",
           p.type::text AS holder,
           m.fill_state::text AS "fillState",
           SUM(m.quantity)::int AS quantity
      FROM (${MOVEMENTS}) m JOIN parties p ON p.id = m.party_id
     WHERE m.date <= ${date}::date AND p.type::text IN (${Prisma.join([...HOLDER_TYPES])})
     GROUP BY m.gas_id, p.type, m.fill_state
  `;
}

function emptyRow(gas: StockReportRow["gas"]): StockReportRow {
  return { gas, shop: { filled: 0, empty: 0, defective: 0 }, customers: 0, refillers: 0, total: 0 };
}

function hasCylinders({ shop, customers, refillers }: StockReportRow): boolean {
  return [shop.filled, shop.empty, shop.defective, customers, refillers].some(
    (count) => count !== 0,
  );
}
