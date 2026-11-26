"use client";

import {
  checkInput,
  FILL_STATES,
  newOpeningStockSchema,
  type BillParty,
  type Gas,
} from "@gasflow/shared";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { buttonStyles } from "@/components/button-styles";
import { Field, SelectField } from "@/components/fields";
import type { Outcome } from "@/lib/api";
import { FILL_STATE_NAMES } from "@/lib/bill-names";
import { BILL_PARTY_TYPE_NAMES } from "@/lib/party-types";
import { addOpeningStock } from "./actions";

export function OpeningStockForm({ parties, gases }: { parties: BillParty[]; gases: Gas[] }) {
  // A number for each line, which stays with it when others are removed.
  const [lines, setLines] = useState([1]);
  // A form that had parties to offer stays, even once a colleague has taken the
  // last of them, so that the refusal can still be read.
  const [openedWithNone] = useState(parties.length === 0);

  async function submit(form: FormData): Promise<Outcome> {
    const gasIds = form.getAll("gasId");
    const fillStates = form.getAll("fillState");
    const quantities = form.getAll("quantity");
    const { data, problem } = checkInput(newOpeningStockSchema, {
      partyId: form.get("partyId"),
      lines: gasIds.map((gasId, index) => ({
        gasId,
        fillState: fillStates[index],
        quantity: Number(quantities[index]),
      })),
    });
    return data ? addOpeningStock(data) : { error: problem };
  }

  if (openedWithNone && parties.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        The shop and every active customer and refiller have opening stock.
      </p>
    );
  }

  return (
    <ActionForm action={submit} submitLabel="Save opening stock">
      <div className="max-w-md">
        <SelectField label="Party" name="partyId" required defaultValue="">
          <option value="">Choose a party</option>
          {parties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name} ({BILL_PARTY_TYPE_NAMES[party.type]})
            </option>
          ))}
        </SelectField>
      </div>
      <ol className="space-y-3">
        {lines.map((line, index) => (
          <li key={line}>
            {/* Two columns on a phone, so that what is chosen can be read. All of
                them may shrink below their contents, so as to fit. */}
            <fieldset className="grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <legend className="sr-only">Line {index + 1}</legend>
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <SelectField label="Gas" name="gasId" required defaultValue="">
                  <option value="">Choose a gas</option>
                  {gases.map((gas) => (
                    <option key={gas.id} value={gas.id}>
                      {gas.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="min-w-0">
                <SelectField label="Fill state" name="fillState" defaultValue="filled">
                  {FILL_STATES.map((fillState) => (
                    <option key={fillState} value={fillState}>
                      {FILL_STATE_NAMES[fillState]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="min-w-0">
                <Field
                  label="Quantity"
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setLines(lines.filter((other) => other !== line))}
                disabled={lines.length === 1}
                className={`${buttonStyles.secondary} col-span-2 justify-self-start sm:col-span-1`}
              >
                Remove<span className="sr-only"> line {index + 1}</span>
              </button>
            </fieldset>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setLines([...lines, Math.max(...lines) + 1])}
        className={buttonStyles.secondary}
      >
        + Add line
      </button>
    </ActionForm>
  );
}
