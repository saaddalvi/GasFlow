"use client";

import {
  checkInput,
  newPartySchema,
  PARTY_TYPES,
  partyChangesSchema,
  type Party,
} from "@gasflow/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { CheckboxField, Field, SelectField, TextAreaField } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { changedOnly } from "@/lib/changed-only";
import { PARTY_TYPE_NAMES } from "@/lib/party-types";
import { addParty, saveParty } from "./actions";
import { PARTIES_PATH, partyPath } from "@/lib/routes";

/** Adds a party, or changes the one given. */
export function PartyForm({ party }: { party?: Party }) {
  const router = useRouter();
  // The party as it was when the form opened, whatever the page has loaded since.
  const [opened] = useState(party);

  async function submit(form: FormData): Promise<Outcome> {
    const typed = {
      name: form.get("name"),
      abbreviation: form.get("abbreviation"),
      mobile: form.get("mobile"),
      contactPerson: form.get("contactPerson"),
      address: form.get("address"),
      notes: form.get("notes"),
      active: form.has("active"),
    };
    if (opened) {
      const { data, problem } = checkInput(partyChangesSchema, typed);
      return data ? saveParty(opened.id, changedOnly(data, opened)) : { error: problem };
    }
    const { data, problem } = checkInput(newPartySchema, { ...typed, type: form.get("type") });
    return data ? addParty(data) : { error: problem };
  }

  return (
    <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
      <ActionForm
        action={submit}
        submitLabel={opened ? "Save changes" : "Create party"}
        onCancel={() => router.push(opened ? partyPath(opened.id) : PARTIES_PATH)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* A party keeps its type, so only a new one chooses. */}
          {!opened && (
            <div className="sm:col-span-2">
              <SelectField
                label="Type"
                name="type"
                required
                defaultValue=""
                hint="It cannot be changed later."
              >
                <option value="" disabled>
                  Choose a type
                </option>
                {PARTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PARTY_TYPE_NAMES[type]}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
          <Field label="Name" name="name" required defaultValue={opened?.name} autoComplete="off" />
          <Field
            label="Abbreviation"
            name="abbreviation"
            defaultValue={opened?.abbreviation}
            autoComplete="off"
            hint="Leave blank to make one from the name."
          />
          <Field
            label="Mobile"
            name="mobile"
            type="tel"
            defaultValue={opened?.mobile ?? ""}
            autoComplete="off"
          />
          <Field
            label="Contact person"
            name="contactPerson"
            defaultValue={opened?.contactPerson ?? ""}
            autoComplete="off"
          />
          <div className="sm:col-span-2">
            <TextAreaField label="Address" name="address" defaultValue={opened?.address ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <TextAreaField label="Notes" name="notes" defaultValue={opened?.notes ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <CheckboxField
              label="Active"
              name="active"
              defaultChecked={opened?.active ?? true}
              hint="Inactive parties are not offered on anything new. A party that holds cylinders or has unmatched returns has to stay active."
            />
          </div>
        </div>
      </ActionForm>
    </section>
  );
}
