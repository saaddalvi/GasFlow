import type { BillType, FillState } from "@gasflow/shared";

export const BILL_TYPE_NAMES: Record<BillType, string> = {
  opening_stock: "Opening stock",
};

export const FILL_STATE_NAMES: Record<FillState, string> = {
  filled: "Filled",
  empty: "Empty",
  defective: "Defective",
};
