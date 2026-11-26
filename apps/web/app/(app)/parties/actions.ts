"use server";

import { partySchema, type NewParty, type PartyChanges } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What the party screens ask for. The API checks every value.

export async function addParty(party: NewParty): Promise<Outcome> {
  return sendChange("POST", "/api/parties", party, async (answer) => ({
    goTo: `/parties/${partySchema.parse(await answer.json()).id}`,
  }));
}

export async function saveParty(partyId: string, changes: PartyChanges): Promise<Outcome> {
  return sendChange("PATCH", partyPath(partyId), changes, () =>
    Promise.resolve({ goTo: `/parties/${encodeURIComponent(partyId)}` }),
  );
}

export async function setPartyActive(partyId: string, active: boolean): Promise<Outcome> {
  return sendChange("PATCH", partyPath(partyId), { active } satisfies PartyChanges);
}

function partyPath(partyId: string): string {
  return `/api/parties/${encodeURIComponent(partyId)}`;
}
