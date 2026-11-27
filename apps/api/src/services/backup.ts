import {
  addDays,
  BACKUP_DAYS_OF_BILLS,
  indianDate,
  REGISTER_PARTY_TYPES,
  type BillStatus,
  type BillType,
  type CancelReason,
  type FillState,
  type PaperKind,
  type RegisterParty,
  type Shop,
  type StockReportRow,
  type WriteOffReason,
} from "@gasflow/shared";
import type { Clock } from "../clock";
import type { Database, Transaction } from "../database";
import { fromDatabaseDate } from "../database-date";
import { withHoldings } from "./holdings";
import { getShop } from "./shop";
import { findStockRows, hasAtShop } from "./stock-report";

/** Everything the offline backup says. */
export interface Backup {
  shop: Shop;
  generatedAt: Date;
  /** A row for each gas in use, and for each retired one the shop has any of. */
  stock: StockReportRow[];
  /** Every customer and refiller, inactive ones too, by name. */
  parties: BackupParty[];
  /** The earliest date a bill in the file may have. */
  billsFrom: string;
  /** Those of either status dated from then on, the newest first. */
  bills: BackupBill[];
}

/** A customer or refiller, with what it holds. */
export type BackupParty = RegisterParty & { notes: string | null };

/** A bill as the file shows it. */
export interface BackupBill {
  type: BillType;
  paperKind: PaperKind | null;
  number: string;
  date: string;
  status: BillStatus;
  /** The name of whom the cylinders leave, or null when they join the business. */
  from: string | null;
  /** The name of who receives them, or null when they leave the business. */
  to: string | null;
  vehicle: { plate: string; label: string | null } | null;
  slipNumber: string | null;
  notes: string | null;
  writeOffReason: WriteOffReason | null;
  /** Set on cancelled bills, and only on those. */
  cancelReason: CancelReason | null;
  cancelNotes: string | null;
  lines: { gas: string; fillState: FillState; quantity: number }[];
}

/** What the records say now, to be kept for when they cannot be reached. */
export function readBackup(db: Database, clock: Clock): Promise<Backup> {
  const generatedAt = clock.now();
  const billsFrom = addDays(indianDate(generatedAt), 1 - BACKUP_DAYS_OF_BILLS);
  // One view of the database throughout, so that a bill saved meanwhile shows in
  // every part of the file or in none. A transaction's one connection runs one
  // query at a time.
  return db.$transaction(
    async (tx) => ({
      generatedAt,
      shop: await getShop(tx),
      stock: await findStockRows(tx, undefined, hasAtShop),
      parties: await findParties(tx),
      billsFrom,
      bills: await findBills(tx, billsFrom),
    }),
    { isolationLevel: "RepeatableRead" },
  );
}

async function findParties(tx: Transaction): Promise<BackupParty[]> {
  const parties = await tx.party.findMany({
    where: { type: { in: [...REGISTER_PARTY_TYPES] } },
    select: { id: true, type: true, name: true, active: true, notes: true },
    // The id keeps parties of one name in the same order in every file.
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const held = await withHoldings(tx, parties);
  // The query gives only these types.
  return held.map((party) => ({ ...party, type: party.type as BackupParty["type"] }));
}

/** The bills of either status dated no earlier than this, the newest first. */
async function findBills(tx: Transaction, from: string): Promise<BackupBill[]> {
  // In one query, with each bill's lines gathered into it.
  const bills = await tx.$queryRaw<(Omit<BackupBill, "date"> & { date: Date })[]>`
    SELECT b.type::text AS type, b.paper_kind::text AS "paperKind", b.number::text AS number,
           b.date, b.status::text AS status, f.name::text AS "from", t.name::text AS "to",
           CASE WHEN v.id IS NOT NULL
                THEN json_build_object('plate', v.plate, 'label', v.label) END AS vehicle,
           b.slip_number AS "slipNumber", b.notes,
           b.write_off_reason::text AS "writeOffReason",
           b.cancel_reason::text AS "cancelReason", b.cancel_notes AS "cancelNotes",
           (SELECT json_agg(
                     json_build_object('gas', g.name, 'fillState', l.fill_state,
                                       'quantity', l.quantity)
                     ORDER BY l.line_no)
              FROM bill_lines l JOIN gases g ON g.id = l.gas_id
             WHERE l.bill_id = b.id) AS lines
      FROM bills b
      LEFT JOIN parties f ON f.id = b.from_party_id
      LEFT JOIN parties t ON t.id = b.to_party_id
      LEFT JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.date >= ${from}::date
     ORDER BY b.date DESC, b.entered_at DESC, b.id DESC
  `;
  return bills.map(({ date, ...bill }) => ({ ...bill, date: fromDatabaseDate(date) }));
}
