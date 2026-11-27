import {
  BILL_TYPE_NAMES,
  PAPER_KIND_NAMES,
  WRITE_OFF_REASON_NAMES,
  type Bill,
  type BillLine,
} from "@gasflow/shared";

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
