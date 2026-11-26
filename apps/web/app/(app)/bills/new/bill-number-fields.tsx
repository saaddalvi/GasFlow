"use client";

import {
  billNumberUseQuerySchema,
  billNumberUseSchema,
  PAPER_KIND_NAMES,
  PAPER_KINDS,
  refillerRefillerSlipNumberUseQuerySchema,
  type BillNumberUse,
  type PaperKind,
} from "@gasflow/shared";
import Link from "next/link";
import { Field, SelectField } from "@/components/fields";
import { formatDate } from "@/lib/dates";
import { billPath, NEW_BILL_PATH } from "@/lib/routes";
import { useLookup } from "@/lib/use-lookup";
import type { ChosenParty } from "./party-picker";

/** The paper kind and bill number, with a warning while a number already used is typed. */
export function BillNumberFields({
  paperKind,
  number,
  onPaperKind,
  onNumber,
  askAgain,
  ownBillId,
}: {
  paperKind: PaperKind;
  number: string;
  onPaperKind: (paperKind: PaperKind) => void;
  onNumber: (number: string) => void;
  /** Changes when the number should be looked up again. */
  askAgain: number;
  /** The bill being corrected, whose own number is no cause for warning. */
  ownBillId?: string;
}) {
  const query = billNumberUseQuerySchema.safeParse({ paperKind, number });
  const usedBy = useNumberUse("number-use", query.data, askAgain, ownBillId);

  return (
    <>
      <SelectField
        label="Paper kind"
        required
        value={paperKind}
        onChange={(event) => onPaperKind(event.target.value as PaperKind)}
      >
        {PAPER_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {PAPER_KIND_NAMES[kind]}
          </option>
        ))}
      </SelectField>
      <NumberField label="Bill number" number={number} onNumber={onNumber} usedBy={usedBy}>
        {PAPER_KIND_NAMES[paperKind]} number {query.data?.number} is already used, on a bill
      </NumberField>
    </>
  );
}

/**
 * The refiller's slip number, with a warning while one already used for that
 * refiller is typed.
 */
export function RefillerSlipNumberField({
  refiller,
  number,
  onNumber,
  askAgain,
  ownBillId,
}: {
  /** Whose slip it is, once chosen. Until then nothing can be looked up. */
  refiller: ChosenParty | null;
  number: string;
  onNumber: (number: string) => void;
  /** Changes when the number should be looked up again. */
  askAgain: number;
  /** The bill being corrected, whose own number is no cause for warning. */
  ownBillId?: string;
}) {
  const query = refillerRefillerSlipNumberUseQuerySchema.safeParse({
    refillerId: refiller?.id,
    number,
  });
  const usedBy = useNumberUse("refiller-slip-number-use", query.data, askAgain, ownBillId);

  return (
    <NumberField label="Refiller's slip number" number={number} onNumber={onNumber} usedBy={usedBy}>
      {refiller?.name}&rsquo;s slip number {query.data?.number} is already used, on a return from
      refiller
    </NumberField>
  );
}

/**
 * The other posted bill that has the number asked about, if the answer is in and
 * there is one.
 */
function useNumberUse(
  question: "number-use" | "refiller-slip-number-use",
  query: Record<string, string> | undefined,
  askAgain: number,
  ownBillId: string | undefined,
) {
  const answer = useLookup(
    query ? `${NEW_BILL_PATH}/${question}?${new URLSearchParams(query).toString()}` : null,
    billNumberUseSchema,
    askAgain,
  );
  const usedBy = answer?.data?.usedBy;
  return usedBy?.id === ownBillId ? undefined : usedBy;
}

/** A box for a bill's number, warning of the bill that already has it. */
function NumberField({
  label,
  number,
  onNumber,
  usedBy,
  children,
}: {
  label: string;
  number: string;
  onNumber: (number: string) => void;
  usedBy: BillNumberUse["usedBy"] | undefined;
  /** The start of the warning, which goes on to give the bill's date. */
  children: React.ReactNode;
}) {
  return (
    <div>
      <Field
        label={label}
        required
        autoComplete="off"
        value={number}
        aria-invalid={Boolean(usedBy)}
        onChange={(event) => onNumber(event.target.value)}
      />
      <p aria-live="polite" className="mt-1 text-sm text-rose-700 empty:hidden">
        {usedBy && (
          <>
            {children} dated {formatDate(usedBy.date)}.{" "}
            {/* In a new tab, so that this bill is not lost. */}
            <Link href={billPath(usedBy.id)} target="_blank" className="underline">
              View it<span className="sr-only"> in a new tab</span>
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
