"use client";

import { checkInput, newVehicleSchema, vehicleChangesSchema, type Vehicle } from "@gasflow/shared";
import { useState } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { ActionForm } from "@/components/action-form";
import { CheckboxField, Field } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { changedOnly } from "@/lib/changed-only";
import { addVehicle, saveVehicle } from "./actions";

export function AddVehicleForm() {
  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newVehicleSchema, typedIn(form));
    return data ? addVehicle(data) : { error: problem };
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-semibold">Add a vehicle</h2>
      <ActionForm action={submit} submitLabel="Add vehicle">
        <div className="grid gap-4 md:grid-cols-2">
          <VehicleFields />
        </div>
      </ActionForm>
    </section>
  );
}

export function EditVehicleDialog({ vehicle }: { vehicle: Vehicle }) {
  // The vehicle as it was when the box opened, whatever the page has loaded since.
  const [opened, setOpened] = useState(vehicle);

  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(vehicleChangesSchema, typedIn(form));
    return data ? saveVehicle(opened.id, changedOnly(data, opened)) : { error: problem };
  }

  return (
    <ActionDialog
      trigger="Edit"
      title={`Edit ${vehicle.plate}`}
      description="Inactive vehicles are not offered on anything new."
      submitLabel="Save changes"
      onOpen={() => setOpened(vehicle)}
      action={submit}
    >
      <VehicleFields vehicle={opened} />
    </ActionDialog>
  );
}

function VehicleFields({ vehicle }: { vehicle?: Vehicle }) {
  return (
    <>
      <Field
        label="Number plate"
        name="plate"
        required
        defaultValue={vehicle?.plate}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
      <Field
        label="Label"
        name="label"
        defaultValue={vehicle?.label ?? ""}
        autoComplete="off"
        hint="Something to know it by, such as Blue tempo."
      />
      <div className="md:col-span-2">
        <CheckboxField label="Active" name="active" defaultChecked={vehicle?.active ?? true} />
      </div>
    </>
  );
}

function typedIn(form: FormData) {
  return { plate: form.get("plate"), label: form.get("label"), active: form.has("active") };
}
