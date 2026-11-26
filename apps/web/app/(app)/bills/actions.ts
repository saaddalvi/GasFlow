"use server";

import type { BillCorrection, NewCancellation } from "@gasflow/shared";
import { sendChange, type Outcome } from "@/lib/api";
import { billPath } from "@/lib/routes";

// What screens ask for about bills already saved. The API decides whether the
// person asking is allowed, and checks every value.

/** Changes a bill to what the correction says, then shows it. */
export async function correctBill(billId: string, correction: BillCorrection): Promise<Outcome> {
  return sendChange("PUT", `/api/bills/${encodeURIComponent(billId)}`, correction, () =>
    Promise.resolve({ goTo: billPath(billId) }),
  );
}

/** Cancels a bill for good. */
export async function cancelBill(billId: string, cancellation: NewCancellation): Promise<Outcome> {
  return sendChange("POST", `/api/bills/${encodeURIComponent(billId)}/cancel`, cancellation);
}
