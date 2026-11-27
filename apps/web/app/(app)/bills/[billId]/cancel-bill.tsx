"use client";

import {
  CANCEL_REASONS,
  checkInput,
  newCancellationSchema,
  type NewCancellation,
  CANCEL_REASON_NAMES,
} from "@gasflow/shared";
import { useRef, useState } from "react";
import { ActionDialog, type ActionDialogHandle } from "@/components/action-dialog";
import { buttonStyles } from "@/components/button-styles";
import { SelectField, TextAreaField } from "@/components/fields";
import { cancelBill } from "../actions";

/** Asks why a bill is to be cancelled, confirms it, and cancels it. */
export function CancelBill({
  billId,
  name,
  offered,
}: {
  billId: string;
  /** What staff call the bill, such as "Cash memo 88". */
  name: string;
  /** Whether to ask. The box that confirms outlasts this, to say why it was refused. */
  offered: boolean;
}) {
  const confirmation = useRef<ActionDialogHandle>(null);
  // What was chosen when the box was last opened, which is what it cancels with.
  const [chosen, setChosen] = useState<NewCancellation>();
  const [problem, setProblem] = useState<string>();

  function confirm(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { data, problem } = checkInput(newCancellationSchema, {
      reason: form.get("reason"),
      notes: form.get("notes"),
    });
    setProblem(problem);
    if (data) {
      setChosen(data);
      confirmation.current?.open();
    }
  }

  return (
    <>
      {offered && (
        <section
          aria-labelledby="cancel-heading"
          className="max-w-2xl space-y-3 rounded-xl border border-rose-200 bg-white p-5"
        >
          <div>
            <h2 id="cancel-heading" className="font-semibold">
              Cancel bill
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              For a bill entered by mistake. It stays here to be read, but no longer counts towards
              any figure.
            </p>
          </div>
          <form onSubmit={confirm} className="space-y-4">
            <SelectField label="Reason" name="reason" required defaultValue="">
              <option value="">Choose a reason</option>
              {CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {CANCEL_REASON_NAMES[reason]}
                </option>
              ))}
            </SelectField>
            <TextAreaField label="Notes" name="notes" maxLength={1000} hint="Optional." />
            {problem && (
              <p role="alert" className="text-sm text-rose-700">
                {problem}
              </p>
            )}
            <div className="flex justify-end">
              <button type="submit" className={buttonStyles.danger}>
                Cancel bill
              </button>
            </div>
          </form>
        </section>
      )}
      <ActionDialog
        ref={confirmation}
        title={`Cancel ${name}?`}
        description={`Reason: ${chosen ? CANCEL_REASON_NAMES[chosen.reason] : ""}. A cancelled bill cannot be restored.`}
        submitLabel="Yes, cancel it"
        cancelLabel="Keep bill"
        danger
        // The box opens only once there is something chosen.
        action={() => cancelBill(billId, chosen!)}
      />
    </>
  );
}
