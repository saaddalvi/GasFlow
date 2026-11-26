"use client";

import { checkInput, newPartySchema, type Party } from "@gasflow/shared";
import { ActionDialog, type ActionDialogHandle } from "@/components/action-dialog";
import { Field, TextAreaField } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { addCustomer } from "./actions";

/** Adds a customer from a bill, leaving what has been entered on the bill as it is. */
export function NewCustomerDialog({
  ref,
  name,
  onAdded,
}: {
  ref: React.Ref<ActionDialogHandle>;
  /** What was typed in the picker, to begin the name with. */
  name: string;
  onAdded: (customer: Party) => void;
}) {
  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newPartySchema, {
      type: "customer",
      name: form.get("name"),
      mobile: form.get("mobile"),
      contactPerson: form.get("contactPerson"),
      address: form.get("address"),
    });
    if (!data) {
      return { error: problem };
    }
    const { added, ...outcome } = await addCustomer(data);
    if (added) onAdded(added);
    return outcome;
  }

  return (
    <ActionDialog
      ref={ref}
      title="New customer"
      description="The bill stays as it is. More details can be added on the customer's page later."
      action={submit}
      submitLabel="Add customer"
    >
      <Field label="Name" name="name" required defaultValue={name} autoComplete="off" />
      <Field label="Mobile" name="mobile" type="tel" autoComplete="off" />
      <Field label="Contact person" name="contactPerson" autoComplete="off" />
      <TextAreaField label="Address" name="address" />
    </ActionDialog>
  );
}
