"use client";

import type { Bill } from "@gasflow/shared";
import { useLastGiven } from "@/lib/use-last-given";
import { BillForm, type FormChoices, type PaperBill } from "../../new/bill-form";
import { OpeningStockCorrectionForm } from "./opening-stock-correction-form";

/** A bill that can be corrected, and what its form offers. */
export interface Correctable {
  bill: Bill;
  choices: FormChoices;
}

/**
 * The form for correcting a bill. Once up it stays, even if the bill can no longer
 * be corrected, so that a refusal can still be read.
 */
export function CorrectionForm({
  correctable,
  children,
}: {
  correctable: Correctable | null;
  /** Why there is no form, when there never has been one. */
  children: React.ReactNode;
}) {
  const shown = useLastGiven(correctable);
  if (!shown) {
    return children;
  }
  const { bill, choices } = shown;
  return bill.type === "opening_stock" ? (
    <OpeningStockCorrectionForm key={bill.id} bill={bill} gases={choices.gases} />
  ) : (
    // A return from a customer is never offered here, which leaves the types the
    // form is for.
    <BillForm key={bill.id} bill={bill as PaperBill} choices={choices} />
  );
}
