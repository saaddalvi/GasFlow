"use client";

import {
  checkInput,
  FILL_STATES,
  splitSchema,
  newReturnSchema,
  pendingBillName,
  pendingListSchema,
  type Split,
  type FillState,
  type Gas,
  type PendingList,
  type ReceivedReturn,
} from "@gasflow/shared";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { BillDateField } from "@/components/bill-date-field";
import { buttonStyles } from "@/components/button-styles";
import { Field, SelectField } from "@/components/fields";
import { asNewLines, blankLine, LineList, nextKey, type FormLine } from "@/components/line-fields";
import { LoadError } from "@/components/load-error";
import { LoadState } from "@/components/load-state";
import type { Choice } from "@/components/search-picker";
import type { Outcome } from "@/lib/api";
import { FILL_STATE_NAMES } from "@/lib/bill-names";
import { holdEnter } from "@/lib/hold-enter";
import { billPath, RECEIVE_EMPTIES_PATH, UNMATCHED_RETURNS_PATH } from "@/lib/routes";
import { useLastGiven } from "@/lib/use-last-given";
import { useLookup, type Lookup } from "@/lib/use-lookup";
import { cancelBill } from "../../bills/actions";
import { saveReturn } from "./actions";
import { ClosedRows } from "./closed-rows";
import { CustomerPicker } from "./customer-picker";
import { FillOldestFirst, type AskedSplit } from "./split-oldest-first";
import { RowCounts, RowHeading } from "./row-heading";

/** What the form offers, and the dates it starts from. */
export interface FormChoices {
  startDate: string;
  today: string;
  /** The gases that can be left unmatched. */
  gases: Gas[];
}

type Row = PendingList["rows"][number];

/** What has been typed and chosen on one row. */
interface Entry {
  quantity: string;
  fillState: FillState;
}

const BLANK: Entry = { quantity: "", fillState: "empty" };

/** The key of a row's entry, from its bill and gas. */
const keyFor = (billId: string, gasId: string) => `${billId} ${gasId}`;

const keyOf = ({ bill, gas }: Row) => keyFor(bill.id, gas.id);

/**
 * The entries with the split put in the rows of its gas. Rows of that gas it
 * leaves out are emptied, and each row keeps its fill state.
 */
function withSplit(entries: Record<string, Entry>, gasId: string, { rows }: Split) {
  const next = Object.fromEntries(
    Object.entries(entries).filter(([key]) => !key.endsWith(keyFor("", gasId))),
  );
  for (const { billId, quantity } of rows) {
    const key = keyFor(billId, gasId);
    next[key] = { ...(entries[key] ?? BLANK), quantity: String(quantity) };
  }
  return next;
}

/** An unmatched row on the form. */
type UnmatchedLine = FormLine & {
  /** Set on the row holding what a fill could not place, which then follows the fill. */
  fromSplit?: boolean;
};

/**
 * The unmatched rows once a new split of the gas is in: the row that holds its
 * leftover cylinders takes the new count, or goes if none are left over. Rows
 * added by hand stay as they are.
 */
function withExcess(lines: UnmatchedLine[], gasId: string, { excess }: Split) {
  return lines.flatMap((line) => {
    if (!line.fromSplit || line.gasId !== gasId) return [line];
    return excess > 0 ? [{ ...line, quantity: String(excess) }] : [];
  });
}

/** What was typed as a count, which is none until it is one that could be saved. */
function cylinders(typed: string): number {
  const quantity = Number(typed);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
}

export function ReceiveForm({ choices }: { choices: FormChoices | null }) {
  const shown = useLastGiven(choices);

  return shown ? (
    <Form choices={shown} />
  ) : (
    <LoadError>
      The form could not be loaded. Check that the API is running, then reload the page.
    </LoadError>
  );
}

function Form({ choices: { startDate, today, gases } }: { choices: FormChoices }) {
  const [customer, setCustomer] = useState<Choice | null>(null);
  const [date, setDate] = useState(today);
  const [slipNumber, setSlipNumber] = useState("");
  // Kept by bill and gas, so that a row keeps its entry while the list is loaded again.
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  // Cylinders beyond everything pending, which go against no bill.
  const [unmatched, setUnmatched] = useState<UnmatchedLine[]>([]);
  // How many saves and Undos have been tried, after any of which the rows may
  // have changed.
  const [changesTried, setChangesTried] = useState(0);
  const [retries, setRetries] = useState(0);
  const [received, setReceived] = useState<ReceivedReturn>();
  const [askedSplit, setAskedSplit] = useState<AskedSplit | null>(null);
  // How many times Fill oldest first has been pressed. It never goes back, so that
  // pressing it again always asks again, even for what was asked before a save.
  const [splitsAsked, setSplitsAsked] = useState(0);
  const dated = date >= startDate;
  const answer = useLookup(
    customer && dated
      ? `${RECEIVE_EMPTIES_PATH}/pending?${new URLSearchParams({ customerId: customer.id, date }).toString()}`
      : null,
    pendingListSchema,
    changesTried + retries,
  );
  const rows = answer?.data?.rows;
  // Asked again whenever the date changes, so that the split follows it.
  const splitAnswer = useLookup(
    customer && dated && askedSplit
      ? `${RECEIVE_EMPTIES_PATH}/split?${new URLSearchParams({
          customerId: customer.id,
          date,
          gasId: askedSplit.gas.id,
          total: String(askedSplit.total),
        }).toString()}`
      : null,
    splitSchema,
    splitsAsked,
  );
  // Each split is put in the rows once, after which staff may change them.
  const [applied, setApplied] = useState<Split>();
  const proposal = splitAnswer?.data;
  if (askedSplit && proposal && proposal !== applied) {
    setApplied(proposal);
    setEntries(withSplit(entries, askedSplit.gas.id, proposal));
    setUnmatched(withExcess(unmatched, askedSplit.gas.id, proposal));
  }
  // Only what is typed on a row that is listed is saved, so what is typed on one
  // that has since left the list is pointed out.
  const listed = new Set(rows?.map(keyOf));
  const leftOut = rows
    ? Object.entries(entries).reduce(
        (total, [key, { quantity }]) => total + (listed.has(key) ? 0 : cylinders(quantity)),
        0,
      )
    : 0;
  const returning = (rows ?? []).flatMap((row) => {
    const { quantity, fillState } = entries[keyOf(row)] ?? BLANK;
    return Number(quantity) === 0
      ? []
      : [{ billId: row.bill.id, gasId: row.gas.id, quantity: Number(quantity), fillState }];
  });

  // Unmatched rows are on screen, and so counted and saved, only under a customer and date.
  const shownUnmatched = customer && dated ? unmatched : [];
  const returningNow =
    returning.reduce((total, { quantity }) => total + cylinders(String(quantity)), 0) +
    shownUnmatched.reduce((total, { quantity }) => total + cylinders(quantity), 0);

  /** Puts this many of the gas under unmatched cylinders, in place of any there. */
  function leaveUnmatched(gasId: string, quantity: number) {
    const replaced = unmatched.find((line) => line.gasId === gasId);
    setUnmatched([
      ...unmatched.filter((line) => line.gasId !== gasId),
      {
        ...blankLine(nextKey(unmatched)),
        gasId,
        fillState: replaced?.fillState,
        quantity: String(quantity),
        fromSplit: true,
      },
    ]);
  }

  function choose(chosen: Choice | null) {
    setCustomer(chosen);
    setEntries({});
    setUnmatched([]);
    setSlipNumber("");
    setAskedSplit(null);
  }

  async function submit(): Promise<Outcome> {
    if (customer && dated && !rows) {
      return { error: "Wait for the pending cylinders to be listed, then save." };
    }
    const { data, problem } = checkInput(newReturnSchema, {
      customerId: customer?.id ?? "",
      date,
      slipNumber,
      allocations: returning,
      unmatched: asNewLines(shownUnmatched, BLANK.fillState),
    });
    if (!data) {
      return { error: problem };
    }
    const answer = await saveReturn(data).catch(() => null);
    // Whatever came of it, the rows are asked for again.
    setChangesTried((count) => count + 1);
    if (!answer) {
      return {
        error:
          "The web app could not be reached. Check whether the return was saved before trying again.",
      };
    }
    const { received, ...outcome } = answer;
    if (received) {
      setReceived(received);
      setEntries({});
      setUnmatched([]);
      setSlipNumber("");
      setAskedSplit(null);
      // The next return is today's unless said otherwise.
      setDate(today);
    }
    return outcome;
  }

  return (
    // The page stays where it is put while the rows load again. See globals.css.
    <div data-holds-scroll className="max-w-4xl space-y-4">
      {/* Always here, so that what appears in it is read out. */}
      <div role="status">
        {/* Stays until the next save that works, so that moving on does not take
            Undo away. */}
        {received && (
          <Confirmation
            key={received.id}
            received={received}
            // Whatever came of it, the rows are asked for again.
            onUndoTried={() => setChangesTried((count) => count + 1)}
          />
        )}
      </div>
      <section onKeyDown={holdEnter} className="rounded-xl border border-slate-200 bg-white p-5">
        <ActionForm action={submit} submitLabel="Save returns">
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {/* On load only. After a save it would scroll the confirmation away. */}
              <CustomerPicker chosen={customer} onChoose={choose} focused={changesTried === 0} />
            </div>
            <BillDateField startDate={startDate} today={today} value={date} onChange={setDate} />
            <Field
              label="Slip number"
              hint="Optional. The number on the paper return slip."
              autoComplete="off"
              maxLength={30}
              value={slipNumber}
              onChange={(event) => setSlipNumber(event.target.value)}
            />
          </div>
          <fieldset className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
            <legend className="float-left w-full font-semibold">Pending cylinders</legend>
            <div className="clear-left space-y-3">
              {!customer ? (
                <Note>Choose a customer to see what they have pending.</Note>
              ) : !dated ? (
                <Note>
                  {date
                    ? "A return cannot be dated before the start date."
                    : "Choose the return date."}
                </Note>
              ) : (
                <>
                  {(Boolean(rows?.length) || askedSplit) && (
                    <FillOldestFirst
                      // Not the key of the closed rows beside it: two alike would
                      // leave a second copy on screen.
                      key={`split ${customer.id}`}
                      rows={rows ?? []}
                      customerName={customer.name}
                      asked={askedSplit}
                      answer={splitAnswer}
                      onFill={(gas, total) => {
                        setAskedSplit({ gas, total });
                        setSplitsAsked((count) => count + 1);
                      }}
                      unmatched={unmatched}
                      canLeaveUnmatched={(gasId) => gases.some((gas) => gas.id === gasId)}
                      onLeaveUnmatched={leaveUnmatched}
                    />
                  )}
                  <Pending
                    answer={answer}
                    customer={customer}
                    entries={entries}
                    onEntry={(key, entry) => setEntries({ ...entries, [key]: entry })}
                    onRetry={() => setRetries(retries + 1)}
                  />
                  <ClosedRows
                    key={`closed ${customer.id}`}
                    customerId={customer.id}
                    date={date}
                    askAgain={changesTried}
                  />
                </>
              )}
            </div>
          </fieldset>
          {customer && dated && (
            <fieldset className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
              <legend className="float-left w-full font-semibold">Unmatched cylinders</legend>
              <p className="clear-left text-sm text-slate-500">
                Cylinders beyond everything {customer.name} has pending. Add a gas here only when
                all of it that is pending on this date is being returned above.
              </p>
              <LineList
                lines={unmatched}
                onChange={setUnmatched}
                gases={gases}
                defaultFillState={BLANK.fillState}
                addLabel="+ Add unmatched cylinders"
                mayBeEmpty
              />
            </fieldset>
          )}
          <p aria-live="polite" className="text-sm text-amber-800 empty:hidden">
            {leftOut > 0 &&
              `Not included: ${leftOut} typed against what is no longer listed. Check the rows before saving.`}
          </p>
          <p aria-live="polite" className="text-right text-sm tabular-nums">
            <span className="text-slate-500">Returning now </span>
            <span className="font-semibold">{returningNow}</span>
          </p>
        </ActionForm>
      </section>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

/** The rows the customer can return cylinders against, or why none are shown. */
function Pending({
  answer,
  customer,
  entries,
  onEntry,
  onRetry,
}: {
  answer: Lookup<PendingList> | undefined;
  customer: Choice;
  entries: Record<string, Entry>;
  onEntry: (key: string, entry: Entry) => void;
  onRetry: () => void;
}) {
  const rows = answer?.data?.rows;
  if (!rows) {
    return <LoadState what="pending cylinders" failed={answer?.failed} onRetry={onRetry} />;
  }
  if (rows.length === 0) {
    return <Note>Nothing is pending from {customer.name} on this date.</Note>;
  }
  return (
    <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
      {rows.map((row) => (
        <PendingRowFields
          key={keyOf(row)}
          row={row}
          entry={entries[keyOf(row)] ?? BLANK}
          onChange={(entry) => onEntry(keyOf(row), entry)}
        />
      ))}
    </ol>
  );
}

/** One bill and gas, with the boxes for what is returning against it now. */
function PendingRowFields({
  row,
  entry,
  onChange,
}: {
  row: Row;
  entry: Entry;
  onChange: (entry: Entry) => void;
}) {
  const name = `${pendingBillName(row.bill)}, ${row.gas.name}`;

  return (
    <li className="px-4 py-3">
      <fieldset className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto_18rem] md:items-center">
        <legend className="sr-only">{name}</legend>
        <div className="flex items-start justify-between gap-3 md:block">
          <RowHeading row={row} />
          <p className="whitespace-nowrap text-slate-500">
            {row.daysOut === 1 ? "1 day out" : `${row.daysOut} days out`}
          </p>
        </div>
        <RowCounts row={row} />
        {/* On the narrowest phones the fill state drops below, so that it can be read. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 min-[26rem]:grid-cols-[minmax(0,5rem)_auto_minmax(0,1fr)]">
          <Field
            label="Returning"
            type="number"
            inputMode="numeric"
            min={0}
            max={row.pending}
            step={1}
            value={entry.quantity}
            onChange={(event) => onChange({ ...entry, quantity: event.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange({ ...entry, quantity: String(row.pending) })}
            className={`${buttonStyles.secondary} whitespace-nowrap`}
          >
            All {row.pending}
            <span className="sr-only">: {name}</span>
          </button>
          <div className="col-span-2 min-w-0 min-[26rem]:col-span-1">
            <SelectField
              label="Fill state"
              value={entry.fillState}
              onChange={(event) =>
                onChange({ ...entry, fillState: event.target.value as FillState })
              }
            >
              {FILL_STATES.map((fillState) => (
                <option key={fillState} value={fillState}>
                  {FILL_STATE_NAMES[fillState]}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </fieldset>
    </li>
  );
}

/**
 * What was just saved: who returned how many, and against which bills. For a
 * little while it can be undone.
 */
function Confirmation({
  received,
  onUndoTried,
}: {
  received: ReceivedReturn;
  onUndoTried: () => void;
}) {
  const { id, number } = received;
  const shown = useRef<HTMLDivElement>(null);
  const { offered, undoing, undone, error, undo } = useUndo(id, onUndoTried);

  // The button that saved is at the foot of a form that may be long.
  useEffect(() => {
    shown.current?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    // The margin keeps it clear of the navigation bar, which stays at the top.
    <div
      ref={shown}
      className={`scroll-mt-20 space-y-2 rounded-lg border px-4 py-3 text-sm wrap-anywhere ${
        undone
          ? "border-slate-200 bg-slate-100 text-slate-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {undone ? (
        <p>
          Undone:{" "}
          <Link href={billPath(id)} className="font-medium underline">
            {number}
          </Link>{" "}
          is cancelled, and its cylinders are as they were before it.
        </p>
      ) : (
        <Saved received={received} />
      )}
      {error && !undone && (
        <p className="text-rose-700">
          {error}{" "}
          <Link href={billPath(id)} className="font-medium underline">
            Open {number}
          </Link>
        </p>
      )}
      {offered && (
        <button type="button" onClick={undo} disabled={undoing} className={buttonStyles.secondary}>
          {undoing ? "Undoing…" : "Undo"}
          <span className="sr-only"> {number}</span>
        </button>
      )}
    </div>
  );
}

/** How long after a save its Undo is offered. */
const UNDO_MS = 10_000;

/** Undo for a return just saved, which cancels it as a data entry error. */
function useUndo(returnId: string, onTried: () => void) {
  const [expired, setExpired] = useState(false);
  const [undoing, startUndoing] = useTransition();
  const [undone, setUndone] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), UNDO_MS);
    return () => clearTimeout(timer);
  }, []);

  function undo() {
    setError(undefined);
    startUndoing(async () => {
      const outcome = await cancelBill(returnId, {
        reason: "data_entry_error",
        notes: null,
      }).catch((): Outcome => ({
        error: "The web app could not be reached. Check whether the return was cancelled.",
      }));
      setError(outcome.error);
      setUndone(!outcome.error);
      onTried();
    });
  }

  // One already under way is shown through, however long it takes.
  return { offered: !undone && (undoing || !expired), undoing, undone, error, undo };
}

function Saved({
  received: { id, number, customer, quantity, unmatched, bills },
}: {
  received: ReceivedReturn;
}) {
  const link = "font-medium underline";

  return (
    <p>
      Saved{" "}
      <Link href={billPath(id)} className={link}>
        {number}
      </Link>
      : {customer.name} returned {quantity === 1 ? "1 cylinder" : `${quantity} cylinders`}
      {bills.length === 0 ? (
        quantity === 1 ? (
          ", unmatched"
        ) : (
          ", all unmatched"
        )
      ) : (
        <>
          {unmatched > 0 ? `, ${quantity - unmatched} of them against ` : " against "}
          {bills.map((bill, index) => (
            <Fragment key={bill.id}>
              {index > 0 && (index === bills.length - 1 ? " and " : ", ")}
              <Link href={billPath(bill.id)} className={link}>
                {pendingBillName(bill)}
              </Link>
            </Fragment>
          ))}
        </>
      )}
      .
      {unmatched > 0 && (
        <>
          {bills.length > 0 &&
            ` The other ${unmatched} ${unmatched === 1 ? "is" : "are"} unmatched.`}{" "}
          <Link href={UNMATCHED_RETURNS_PATH} className={link}>
            See unmatched returns
          </Link>
        </>
      )}
    </p>
  );
}
