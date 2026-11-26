"use client";

import { checkInput, newOpeningStockSchema, type BillParty, type Gas } from "@gasflow/shared";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SelectField } from "@/components/fields";
import { asNewLines, blankLine, LineList } from "@/components/line-fields";
import type { Outcome } from "@/lib/api";
import { BILL_PARTY_TYPE_NAMES } from "@/lib/party-types";
import { addOpeningStock } from "./actions";

export function OpeningStockForm({ parties, gases }: { parties: BillParty[]; gases: Gas[] }) {
  const [lines, setLines] = useState(() => [blankLine(1)]);
  // A form that had parties to offer stays, even once a colleague has taken the
  // last of them, so that the refusal can still be read.
  const [openedWithNone] = useState(parties.length === 0);

  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newOpeningStockSchema, {
      partyId: form.get("partyId"),
      lines: asNewLines(lines, "filled"),
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
      <LineList lines={lines} onChange={setLines} gases={gases} defaultFillState="filled" />
    </ActionForm>
  );
}
