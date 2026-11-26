"use server";

import type { NewCancellation } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";

// What screens ask for about bills already saved. The API decides whether the
// person asking is allowed, and checks every value.

/** Cancels a bill for good. */
export async function cancelBill(billId: string, cancellation: NewCancellation): Promise<Outcome> {
  return sendChange("POST", `/api/bills/${encodeURIComponent(billId)}/cancel`, cancellation);
}
