"use server";

import { partySchema, type NewParty, type PartyChanges } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";
import { partyPath } from "@/lib/routes";

// What the party screens ask for. The API checks every value.

export async function addParty(party: NewParty): Promise<Outcome> {
  return sendChange("POST", "/api/parties", party, async (answer) => ({
    goTo: partyPath(partySchema.parse(await answer.json()).id),
  }));
}

export async function saveParty(partyId: string, changes: PartyChanges): Promise<Outcome> {
  return sendChange("PATCH", partyApiPath(partyId), changes, () =>
    Promise.resolve({ goTo: partyPath(partyId) }),
  );
}

export async function setPartyActive(partyId: string, active: boolean): Promise<Outcome> {
  return sendChange("PATCH", partyApiPath(partyId), { active } satisfies PartyChanges);
}

function partyApiPath(partyId: string): string {
  return `/api/parties/${encodeURIComponent(partyId)}`;
}
