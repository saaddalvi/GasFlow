"use client";

import { partyListSchema, type Party, type PartyType } from "@gasflow/shared";
import { buttonStyles } from "@/components/button-styles";
import { SearchPicker } from "@/components/search-picker";
import { PARTY_TYPE_NAMES } from "@/lib/party-types";
import { NEW_BILL_PATH } from "@/lib/routes";

/** The types of party a bill entered from paper can name. */
export type PickableType = Extract<PartyType, "customer" | "refiller">;

/** The party on a bill, as much of one as the picker shows. */
export type ChosenParty = Pick<Party, "id" | "name">;

/**
 * A box to search the active customers or refillers by name and choose one, or to
 * add one. Give it a key of its type, so that it starts afresh for another.
 */
export function PartyPicker({
  type,
  chosen,
  onChoose,
  onNew,
}: {
  type: PickableType;
  chosen: ChosenParty | null;
  onChoose: (party: ChosenParty | null) => void;
  /** Called with what has been typed, to begin the new party's name. */
  onNew: (typed: string) => void;
}) {
  return (
    <SearchPicker
      label={PARTY_TYPE_NAMES[type]}
      noun={type}
      chosen={chosen}
      onChoose={(party: Party | null) => onChoose(party && { id: party.id, name: party.name })}
      address={(search) =>
        `${NEW_BILL_PATH}/parties?${new URLSearchParams({ type, search }).toString()}`
      }
      schema={partyListSchema}
      read={({ parties, total }) => ({ options: parties, total })}
      detail={(party) => party.mobile}
    >
      {(typed, close) => (
        <button
          type="button"
          onClick={() => {
            close();
            onNew(typed);
          }}
          className={`${buttonStyles.secondary} shrink-0`}
        >
          + New<span className="sr-only"> {type}</span>
        </button>
      )}
    </SearchPicker>
  );
}
