"use server";

import { billSchema, partySchema, type NewBill, type NewParty, type Party } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";
import { billPath } from "@/lib/routes";

// What the New bill screen asks for. The API checks every value.

export async function saveBill(bill: NewBill): Promise<Outcome> {
  return sendChange("POST", "/api/bills", bill, async (answer) => ({
    goTo: billPath(billSchema.parse(await answer.json()).id),
  }));
}

/** Adds a party without leaving the bill, and gives it back to be chosen. */
export async function addParty(party: NewParty): Promise<Outcome & { added?: Party }> {
  let added: Party | undefined;
  const outcome = await sendChange("POST", "/api/parties", party, async (answer) => {
    added = partySchema.parse(await answer.json());
    return {};
  });
  return { ...outcome, added };
}
