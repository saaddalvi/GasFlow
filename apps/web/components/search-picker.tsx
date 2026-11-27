"use client";

import { useEffect, useId, useRef, useState } from "react";
import { controlStyles, Labelled } from "@/components/fields";
import { useLookup, type Lookup } from "@/lib/use-lookup";

/** The most of a chosen option that the box needs. */
export interface Choice {
  id: string;
  name: string;
}

/** The options that match what was typed, and how many there are in all. */
interface Matches<Option> {
  options: Option[];
  total: number;
}

/**
 * A box to search by name and choose one of what matches. Give it a new key
 * should it come to search for something else, so that it starts afresh.
 */
export function SearchPicker<Answer, Option extends Choice>({
  label,
  noun,
  plural = `${noun}s`,
  noMatch = `No active ${noun} matches.`,
  chosen,
  onChoose,
  address,
  schema,
  read,
  detail,
  focused = false,
  optional = false,
  children,
}: {
  label: string;
  /** What is searched for, such as "customer". */
  noun: string;
  /** More than one of them, if adding an "s" does not say it. */
  plural?: string;
  /** What is said when nothing matches, if more than the active are searched. */
  noMatch?: string;
  chosen: Choice | null;
  /** Called with null once the chosen name is typed over. */
  onChoose: (option: Option | null) => void;
  /** Where to ask this web app for the matches to a search. */
  address: (search: string) => string;
  /** Checks what came back. It must not change between renders. */
  schema: { parse: (body: unknown) => Answer };
  read: (answer: Answer) => Matches<Option>;
  /** A second line under an option's name. */
  detail?: (option: Option) => React.ReactNode;
  /** Whether the box takes the focus when it appears. */
  focused?: boolean;
  /** Whether it may be left blank. Otherwise its form is to see that one is chosen. */
  optional?: boolean;
  /** What sits beside the box, given what has been typed and how to close the list. */
  children?: (typed: string, close: () => void) => React.ReactNode;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  // The option that Enter would choose, moved with the arrow keys.
  const [marked, setMarked] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // Once an option is chosen the box shows its name, and a fresh look lists everyone.
  const search = chosen ? "" : typed;
  const answer = useLookup(open ? address(search) : null, schema);
  const matches = answer?.data === undefined ? undefined : read(answer.data);
  const found = matches?.options ?? [];
  const optionId = (index: number) => `${id}-option-${index}`;
  const expanded = open && found.length > 0;

  useEffect(() => {
    if (focused) input.current?.focus();
  }, [focused]);

  useEffect(() => {
    list.current?.children[marked]?.scrollIntoView({ block: "nearest" });
  }, [marked]);

  // A name typed but not chosen would be saved as blank, so the form is held back.
  const unchosen = optional && !chosen && typed.trim() !== "";
  useEffect(() => {
    input.current?.setCustomValidity(
      unchosen ? `Choose a ${noun} from the list, or clear the box.` : "",
    );
  }, [unchosen, noun]);

  // The list always opens, and changes, with its first option marked.
  function show() {
    setMarked(0);
    setOpen(true);
  }

  function choose(option: Option) {
    onChoose(option);
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
      // Enter chooses an option here. It never saves the form.
      event.preventDefault();
      const option = open ? found[marked] : undefined;
      if (option) choose(option);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Labelled label={label} hint={optional ? "Optional." : undefined} required={!optional}>
      {({ id: inputId, "aria-describedby": hintId }) => (
        <>
          <div className="relative flex min-w-0 flex-1">
            <input
              ref={input}
              id={inputId}
              role="combobox"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={expanded ? optionId(marked) : undefined}
              aria-required={!optional}
              aria-describedby={hintId}
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
                  aria-label={plural}
                  className="max-h-64 overflow-y-auto"
                >
                  {found.map((option, index) => (
                    <li
                      key={option.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === marked}
                      onClick={() => choose(option)}
                      className={`cursor-pointer px-3 py-2 text-sm wrap-anywhere ${
                        index === marked ? "bg-brand-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {option.name}
                      {detail && (
                        <span className="block text-slate-500 empty:hidden">{detail(option)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <Note plural={plural} noMatch={noMatch} answer={answer} matches={matches} />
              </div>
            )}
          </div>
          {children?.(search.trim(), () => setOpen(false))}
        </>
      )}
    </Labelled>
  );
}

/** What the list cannot say by itself. */
function Note({
  plural,
  noMatch,
  answer,
  matches,
}: {
  plural: string;
  noMatch: string;
  answer: Lookup<unknown> | undefined;
  matches: Matches<unknown> | undefined;
}) {
  const note = answer?.failed
    ? `The ${plural} could not be searched. Check your connection and type again.`
    : !matches
      ? "Searching…"
      : matches.total === 0
        ? noMatch
        : matches.total > matches.options.length
          ? `Showing ${matches.options.length} of ${matches.total}. Type more of the name.`
          : null;

  return (
    <p role="status" className={note ? "px-3 py-2 text-sm text-slate-500" : "sr-only"}>
      {note}
    </p>
  );
}
