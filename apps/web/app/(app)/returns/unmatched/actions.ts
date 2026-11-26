"use server";

import type { NewMatch } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What the Unmatched returns screen asks for. The API checks every value.

/** Matches unmatched cylinders on a return to a bill. */
export async function matchToBill(returnId: string, match: NewMatch): Promise<Outcome> {
  return sendChange("POST", `/api/returns/${encodeURIComponent(returnId)}/matches`, match);
}
