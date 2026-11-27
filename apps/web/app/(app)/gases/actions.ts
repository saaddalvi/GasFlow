"use server";

import type { GasChanges, NewGas } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What an admin asks for on the Gases screen. The API decides whether the person
// asking is allowed, and checks every value.

export async function addGas(gas: NewGas): Promise<Outcome> {
  return sendChange("POST", "/api/gases", gas);
}

export async function changeGas(gasId: string, changes: GasChanges): Promise<Outcome> {
  return sendChange("PATCH", `/api/gases/${encodeURIComponent(gasId)}`, changes);
}
