"use client";

import { ActionForm } from "@/components/action-form";
import { Field, NewPasswordField } from "@/components/fields";
import { addStaff } from "./actions";

export function AddStaffForm() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-semibold">Add a staff member</h2>
      <ActionForm action={addStaff} submitLabel="Add staff member">
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Name"
            name="displayName"
            required
            maxLength={100}
            autoComplete="off"
            hint="Shown on the bills they enter."
          />
          <Field
            label="Username"
            name="username"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            hint="4 to 64 letters, numbers, - or _."
          />
          <NewPasswordField label="Starting password" name="password" required />
        </div>
      </ActionForm>
    </section>
  );
}
