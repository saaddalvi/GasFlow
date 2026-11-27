"use client";

import { checkInput, MOST_OVERDUE_DAYS, newOverdueLimitSchema } from "@gasflow/shared";
import { ActionDialog } from "@/components/action-dialog";
import { Field } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { setOverdueLimit } from "./actions";

/** For an admin to change the overdue limit from what it is now. */
export function OverdueLimitDialog({ days }: { days: number }) {
  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newOverdueLimitSchema, {
      days: Number(form.get("days")),
    });
    return data ? setOverdueLimit(data) : { error: problem };
  }

  return (
    <ActionDialog
      trigger="Change limit"
      title="Change the overdue limit"
      description="Cylinders are overdue once they have been out for more days than this. It applies to every customer."
      submitLabel="Save limit"
      action={submit}
    >
      <Field
        label="Days"
        name="days"
        type="number"
        inputMode="numeric"
        min={1}
        max={MOST_OVERDUE_DAYS}
        step={1}
        defaultValue={days}
        required
      />
    </ActionDialog>
  );
}
