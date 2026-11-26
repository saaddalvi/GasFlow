import {
  PAPER_KIND_NAMES,
  type Bill,
  type BillLine,
  type BillStatus,
  type BillType,
  type CancelReason,
  type FillState,
  type WriteOffReason,
} from "@gasflow/shared";

export const BILL_TYPE_NAMES: Record<BillType, string> = {
  opening_stock: "Opening stock",
  dispatch: "Dispatch",
  send_to_refiller: "Send to refiller",
  return_from_refiller: "Return from refiller",
  return_from_customer: "Return",
  add_cylinders: "Add cylinders",
  write_off: "Write-off",
};

export const WRITE_OFF_REASON_NAMES: Record<WriteOffReason, string> = {
  scrapped: "Scrapped",
  lost: "Lost",
};

export const FILL_STATE_NAMES: Record<FillState, string> = {
  filled: "Filled",
  empty: "Empty",
  defective: "Defective",
};

export const BILL_STATUS_NAMES: Record<BillStatus, string> = {
  posted: "Posted",
  cancelled: "Cancelled",
};

export const CANCEL_REASON_NAMES: Record<CancelReason, string> = {
  data_entry_error: "Data entry error",
  duplicate_entry: "Duplicate entry",
  customer_rejected: "Customer rejected",
  wrong_cylinder_loaded: "Wrong cylinder loaded",
  bill_voided: "Bill voided",
  other: "Other",
};

/**
 * What sort of bill it is, with its paper kind or reason if it has one, such as
 * "Dispatch · Cash memo" or "Write-off · Lost".
 */
export function describeBillType({
  type,
  paperKind,
  writeOffReason,
}: Pick<Bill, "type" | "paperKind" | "writeOffReason">): string {
  const detail =
    (paperKind && PAPER_KIND_NAMES[paperKind]) ??
    (writeOffReason && WRITE_OFF_REASON_NAMES[writeOffReason]);
  return [BILL_TYPE_NAMES[type], detail].filter(Boolean).join(" · ");
}

/** The cylinders of each gas on these lines, such as "Argon 2, Nitrogen 5". */
export function quantitiesByGas(lines: Pick<BillLine, "gas" | "quantity">[]): string {
  const totals = new Map<string, number>();
  for (const { gas, quantity } of lines) {
    totals.set(gas.name, (totals.get(gas.name) ?? 0) + quantity);
  }
  return [...totals].map(([gas, quantity]) => `${gas} ${quantity}`).join(", ");
}
