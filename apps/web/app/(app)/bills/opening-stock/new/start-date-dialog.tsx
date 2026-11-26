"use client";

import { checkInput, newStartDateSchema } from "@gasflow/shared";
import { ActionDialog } from "@/components/action-dialog";
import { Field } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { setStartDate } from "./actions";

export function StartDateDialog() {
  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newStartDateSchema, { date: form.get("date") });
    return data ? setStartDate(data) : { error: problem };
  }

  return (
    <ActionDialog
      trigger="Set start date"
      title="Set the start date"
      description="The records begin on this date, and no bill can be dated earlier. It cannot be changed afterwards."
      submitLabel="Set start date"
      action={submit}
    >
      <Field label="Start date" name="date" type="date" required />
    </ActionDialog>
  );
}
