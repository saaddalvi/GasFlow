"use client";

import { PARTY_TYPE_NAMES, partyListSchema, type Party } from "@gasflow/shared";
import Form from "next/form";
import { useState } from "react";
import { buttonStyles } from "@/components/button-styles";
import { Field } from "@/components/fields";
import { SearchPicker, type Choice } from "@/components/search-picker";
import { STOCK_CARD_PATH } from "@/lib/routes";

/**
 * Chooses whose card to show and over which dates. What is chosen goes into the
 * address. Give it a new key when the address changes, so that it starts afresh.
 */
export function CardFilters({
  party,
  from,
  to,
}: {
  party: Choice | null;
  from?: string;
  to?: string;
}) {
  const [chosen, setChosen] = useState(party);

  return (
    <Form
      action={STOCK_CARD_PATH}
      className="rounded-xl border border-slate-200 bg-white p-5 print:hidden"
    >
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <SearchPicker
          label="Customer or refiller"
          noun="party"
          plural="parties"
          noMatch="No customer or refiller matches."
          chosen={chosen}
          onChoose={(found: Party | null) => setChosen(found && { id: found.id, name: found.name })}
          address={(search) =>
            `${STOCK_CARD_PATH}/parties?${new URLSearchParams({ search }).toString()}`
          }
          schema={partyListSchema}
          read={({ parties, total }) => ({ options: parties, total })}
          detail={({ type, active }) => `${PARTY_TYPE_NAMES[type]}${active ? "" : " · Inactive"}`}
        />
        {chosen && <input type="hidden" name="partyId" value={chosen.id} />}
        <Field
          label="From"
          name="from"
          type="date"
          defaultValue={from}
          hint="Blank begins on 1 April."
        />
        <Field label="To" name="to" type="date" defaultValue={to} />
        {/* Level with the boxes, below their labels. */}
        <button
          type="submit"
          disabled={!chosen}
          className={`${buttonStyles.secondary} justify-self-start lg:mt-6`}
        >
          Apply
        </button>
      </div>
    </Form>
  );
}
