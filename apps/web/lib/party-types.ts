import type { BillParty, PartyType } from "@gasflow/shared";

export const PARTY_TYPE_NAMES: Record<PartyType, string> = {
  customer: "Customer",
  refiller: "Refiller",
  supplier: "Supplier",
};

/** The kinds of party a bill can name, which include the shop. */
export const BILL_PARTY_TYPE_NAMES: Record<BillParty["type"], string> = {
  shop: "Shop",
  ...PARTY_TYPE_NAMES,
};
