"use client";

import { partyListSchema, type Party, type PartyList, type PartyType } from "@gasflow/shared";
import { useEffect, useId, useRef, useState } from "react";
import { buttonStyles } from "@/components/button-styles";
import { controlStyles, Labelled } from "@/components/fields";
import { PARTY_TYPE_NAMES } from "@/lib/party-types";
import { NEW_BILL_PATH } from "@/lib/routes";
import { useLookup, type Lookup } from "@/lib/use-lookup";

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
  const id = useId();
  const listId = `${id}-list`;
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  // The option that Enter would choose, moved with the arrow keys.
  const [marked, setMarked] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  // Once a party is chosen the box shows their name, and a fresh look lists everyone.
  const search = chosen ? "" : typed;
  const answer = useLookup(
    open ? `${NEW_BILL_PATH}/parties?${new URLSearchParams({ type, search }).toString()}` : null,
    partyListSchema,
  );
  const found = answer?.data?.parties ?? [];
  const optionId = (index: number) => `${id}-option-${index}`;
  const expanded = open && found.length > 0;

  useEffect(() => {
    list.current?.children[marked]?.scrollIntoView({ block: "nearest" });
  }, [marked]);

  // The list always opens, and changes, with its first party marked.
  function show() {
    setMarked(0);
    setOpen(true);
  }

  function choose(party: Party) {
    onChoose({ id: party.id, name: party.name });
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        show();
      } else if (found.length > 0) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setMarked((marked + step + found.length) % found.length);
      }
    } else if (event.key === "Enter") {
      // Enter chooses a party here. It never saves the bill.
      event.preventDefault();
      const party = open ? found[marked] : undefined;
      if (party) choose(party);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Labelled label={PARTY_TYPE_NAMES[type]} required>
      {({ id: inputId }) => (
        <>
          <div className="relative flex min-w-0 flex-1">
            <input
              id={inputId}
              role="combobox"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={expanded ? optionId(marked) : undefined}
              aria-required="true"
              autoComplete="off"
              placeholder="Search by name"
              value={chosen ? chosen.name : typed}
              onChange={(event) => {
                setTyped(event.target.value);
                show();
                if (chosen) onChoose(null);
              }}
              onFocus={(event) => event.target.select()}
              onClick={show}
              onKeyDown={onKeyDown}
              onBlur={() => setOpen(false)}
              className={controlStyles}
            />
            {open && (
              // Keeps the box focused while the list is pressed or scrolled.
              <div
                onMouseDown={(event) => event.preventDefault()}
                className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg"
              >
                <ul
                  ref={list}
                  id={listId}
                  role="listbox"
                  aria-label={`${PARTY_TYPE_NAMES[type]}s`}
                  className="max-h-64 overflow-y-auto"
                >
                  {found.map((party, index) => (
                    <li
                      key={party.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === marked}
                      onClick={() => choose(party)}
                      className={`cursor-pointer px-3 py-2 text-sm wrap-anywhere ${
                        index === marked ? "bg-brand-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {party.name}
                      {party.mobile && <span className="block text-slate-500">{party.mobile}</span>}
                    </li>
                  ))}
                </ul>
                <Note type={type} answer={answer} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNew(search.trim());
            }}
            className={`${buttonStyles.secondary} shrink-0`}
          >
            + New<span className="sr-only"> {type}</span>
          </button>
        </>
      )}
    </Labelled>
  );
}

/** What the list cannot say by itself. */
function Note({ type, answer }: { type: PickableType; answer: Lookup<PartyList> | undefined }) {
  const list = answer?.data;
  const note = answer?.failed
    ? `The ${type}s could not be searched. Check your connection and type again.`
    : !list
      ? "Searching…"
      : list.total === 0
        ? `No active ${type} matches.`
        : list.total > list.parties.length
          ? `Showing ${list.parties.length} of ${list.total}. Type more of the name.`
          : null;

  return (
    <p role="status" className={note ? "px-3 py-2 text-sm text-slate-500" : "sr-only"}>
      {note}
    </p>
  );
}
