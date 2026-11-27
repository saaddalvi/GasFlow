"use client";

import { checkInput, gasChangesSchema, newGasSchema, type Gas } from "@gasflow/shared";
import { ActionDialog } from "@/components/action-dialog";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { addGas, changeGas } from "./actions";

export function AddGasForm() {
  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newGasSchema, { name: form.get("name") });
    return data ? addGas(data) : { error: problem };
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-semibold">Add a gas</h2>
      <ActionForm action={submit} submitLabel="Add gas">
        <div className="max-w-sm">
          <Field label="Name" name="name" required autoComplete="off" />
        </div>
      </ActionForm>
    </section>
  );
}

/** What an admin can do about one gas. */
export function GasActions({ gas: { id, name, active } }: { gas: Gas }) {
  async function rename(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(gasChangesSchema, { name: form.get("name") });
    return data ? changeGas(id, data) : { error: problem };
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ActionDialog
        trigger="Rename"
        title={`Rename ${name}`}
        description="The new name shows everywhere, including on what has already been recorded."
        submitLabel="Save name"
        action={rename}
      >
        <Field label="Name" name="name" required defaultValue={name} autoComplete="off" />
      </ActionDialog>
      <ActionDialog
        // A new one once this changes, so that its words match.
        key={String(active)}
        trigger={active ? "Retire" : "Bring back"}
        title={active ? `Retire ${name}?` : `Bring back ${name}?`}
        description={
          active
            ? "It will not be offered on new entries. What has already been recorded keeps it, and you can bring it back."
            : "It will be offered on new entries again."
        }
        submitLabel={active ? "Retire" : "Bring back"}
        danger={active}
        action={() => changeGas(id, { active: !active })}
      />
    </div>
  );
}
