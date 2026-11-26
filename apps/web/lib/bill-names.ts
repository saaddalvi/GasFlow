import {
  PAPER_KIND_NAMES,
  type Bill,
  type BillLine,
  type BillType,
  type FillState,
} from "@gasflow/shared";

export const BILL_TYPE_NAMES: Record<BillType, string> = {
  opening_stock: "Opening stock",
  dispatch: "Dispatch",
  send_to_refiller: "Send to refiller",
  return_from_refiller: "Return from refiller",
  return_from_customer: "Return",
};

export const FILL_STATE_NAMES: Record<FillState, string> = {
  filled: "Filled",
  empty: "Empty",
  defective: "Defective",
};

/** What sort of bill it is, with its paper kind if it has one, such as "Dispatch · Cash memo". */
export function describeBillType({ type, paperKind }: Pick<Bill, "type" | "paperKind">): string {
  const name = BILL_TYPE_NAMES[type];
  return paperKind ? `${name} · ${PAPER_KIND_NAMES[paperKind]}` : name;
}

/** The cylinders of each gas on these lines, such as "Argon 2, Nitrogen 5". */
export function quantitiesByGas(lines: Pick<BillLine, "gas" | "quantity">[]): string {
  const totals = new Map<string, number>();
  for (const { gas, quantity } of lines) {
    totals.set(gas.name, (totals.get(gas.name) ?? 0) + quantity);
  }
  return [...totals].map(([gas, quantity]) => `${gas} ${quantity}`).join(", ");
}
