import { PARTY_TYPE_NAMES, type BillParty } from "@gasflow/shared";

/** The kinds of party a bill can name, which include the shop. */
export const BILL_PARTY_TYPE_NAMES: Record<BillParty["type"], string> = {
  shop: "Shop",
  ...PARTY_TYPE_NAMES,
};
