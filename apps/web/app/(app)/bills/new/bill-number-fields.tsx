"use client";

import {
  billNumberUseQuerySchema,
  billNumberUseSchema,
  PAPER_KIND_NAMES,
  PAPER_KINDS,
  type PaperKind,
} from "@gasflow/shared";
import Link from "next/link";
import { Field, SelectField } from "@/components/fields";
import { formatDate } from "@/lib/dates";
import { billPath, NEW_BILL_PATH } from "@/lib/routes";
import { useLookup } from "@/lib/use-lookup";

/** The paper kind and bill number, with a warning while a number already used is typed. */
export function BillNumberFields({
  paperKind,
  number,
  onPaperKind,
  onNumber,
  askAgain,
}: {
  paperKind: PaperKind;
  number: string;
  onPaperKind: (paperKind: PaperKind) => void;
  onNumber: (number: string) => void;
  /** Changes when the number should be looked up again. */
  askAgain: number;
}) {
  const query = billNumberUseQuerySchema.safeParse({ paperKind, number });
  const answer = useLookup(
    query.success
      ? `${NEW_BILL_PATH}/number-use?${new URLSearchParams(query.data).toString()}`
      : null,
    billNumberUseSchema,
    askAgain,
  );
  const usedBy = answer?.data?.usedBy;

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
      <div>
        <Field
          label="Bill number"
          required
          autoComplete="off"
          value={number}
          aria-invalid={Boolean(usedBy)}
          onChange={(event) => onNumber(event.target.value)}
        />
        <p aria-live="polite" className="mt-1 text-sm text-rose-700 empty:hidden">
          {usedBy && (
            <>
              {PAPER_KIND_NAMES[paperKind]} number {query.data?.number} is already used, on a bill
              dated {formatDate(usedBy.date)}. {/* In a new tab, so that this bill is not lost. */}
              <Link href={billPath(usedBy.id)} target="_blank" className="underline">
                View it<span className="sr-only"> in a new tab</span>
              </Link>
            </>
          )}
        </p>
      </div>
    </>
  );
}
