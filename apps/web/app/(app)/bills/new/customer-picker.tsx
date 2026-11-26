"use client";

import { partyListSchema, type Party, type PartyList } from "@gasflow/shared";
import { useEffect, useId, useRef, useState } from "react";
import { buttonStyles } from "@/components/button-styles";
import { controlStyles, Labelled } from "@/components/fields";
import { NEW_BILL_PATH } from "@/lib/routes";
import { useLookup, type Lookup } from "@/lib/use-lookup";

/** The customer on a bill, as much of one as the picker shows. */
export type ChosenCustomer = Pick<Party, "id" | "name">;

/** A box to search the active customers by name and choose one, or to add one. */
export function CustomerPicker({
  chosen,
  onChoose,
  onNew,
}: {
  chosen: ChosenCustomer | null;
  onChoose: (customer: ChosenCustomer | null) => void;
  /** Called with what has been typed, to begin the new customer's name. */
  onNew: (typed: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  // The option that Enter would choose, moved with the arrow keys.
  const [marked, setMarked] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  // Once a customer is chosen the box shows their name, and a fresh look lists everyone.
  const search = chosen ? "" : typed;
  const answer = useLookup(
    open ? `${NEW_BILL_PATH}/customers?search=${encodeURIComponent(search)}` : null,
    partyListSchema,
  );
  const found = answer?.data?.parties ?? [];
  const optionId = (index: number) => `${id}-option-${index}`;
  const expanded = open && found.length > 0;

  useEffect(() => {
    list.current?.children[marked]?.scrollIntoView({ block: "nearest" });
  }, [marked]);

  // The list always opens, and changes, with its first customer marked.
  function show() {
    setMarked(0);
    setOpen(true);
  }

  function choose(customer: Party) {
    onChoose({ id: customer.id, name: customer.name });
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
      // Enter chooses a customer here. It never saves the bill.
      event.preventDefault();
      const customer = open ? found[marked] : undefined;
      if (customer) choose(customer);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Labelled label="Customer" required>
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
                  aria-label="Customers"
                  className="max-h-64 overflow-y-auto"
                >
                  {found.map((customer, index) => (
                    <li
                      key={customer.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === marked}
                      onClick={() => choose(customer)}
                      className={`cursor-pointer px-3 py-2 text-sm wrap-anywhere ${
                        index === marked ? "bg-brand-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {customer.name}
                      {customer.mobile && (
                        <span className="block text-slate-500">{customer.mobile}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <Note answer={answer} />
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
            + New<span className="sr-only"> customer</span>
          </button>
        </>
      )}
    </Labelled>
  );
}

/** What the list cannot say by itself. */
function Note({ answer }: { answer: Lookup<PartyList> | undefined }) {
  const list = answer?.data;
  const note = answer?.failed
    ? "The customers could not be searched. Check your connection and type again."
    : !list
      ? "Searching…"
      : list.total === 0
        ? "No active customer matches."
        : list.total > list.parties.length
          ? `Showing ${list.parties.length} of ${list.total}. Type more of the name.`
          : null;

  return (
    <p role="status" className={note ? "px-3 py-2 text-sm text-slate-500" : "sr-only"}>
      {note}
    </p>
  );
}
