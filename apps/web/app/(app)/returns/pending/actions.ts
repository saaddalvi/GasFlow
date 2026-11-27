"use server";

import type { NewOverdueLimit } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What an admin asks for on the Pending returns screen. The API decides whether
// the person asking is allowed, and checks the number.

export async function setOverdueLimit(limit: NewOverdueLimit): Promise<Outcome> {
  return sendChange("PUT", "/api/overdue-limit", limit);
}
