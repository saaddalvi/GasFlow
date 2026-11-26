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
  type PendingList,
  type ReceivedReturn,
} from "@gasflow/shared";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { BillDateField } from "@/components/bill-date-field";
import { buttonStyles } from "@/components/button-styles";
import { Field, SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import type { Choice } from "@/components/search-picker";
import type { Outcome } from "@/lib/api";
import { FILL_STATE_NAMES } from "@/lib/bill-names";
import { holdEnter } from "@/lib/hold-enter";
import { billPath, RECEIVE_EMPTIES_PATH } from "@/lib/routes";
import { useLastGiven } from "@/lib/use-last-given";
import { useLookup, type Lookup } from "@/lib/use-lookup";
import { saveReturn } from "./actions";
import { ClosedRows } from "./closed-rows";
import { CustomerPicker } from "./customer-picker";
import { FillOldestFirst, type AskedSplit } from "./split-oldest-first";
import { LoadState } from "./load-state";
import { RowCounts, RowHeading } from "./row-heading";

/** The dates the form starts from. */
export interface FormDates {
  startDate: string;
  today: string;
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

/** What was typed as a count, which is none until it is one that could be saved. */
function cylinders(typed: string): number {
  const quantity = Number(typed);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
}

export function ReceiveForm({ dates }: { dates: FormDates | null }) {
  const shown = useLastGiven(dates);

  return shown ? (
    <Form dates={shown} />
  ) : (
    <LoadError>
      The form could not be loaded. Check that the API is running, then reload the page.
    </LoadError>
  );
}

function Form({ dates: { startDate, today } }: { dates: FormDates }) {
  const [customer, setCustomer] = useState<Choice | null>(null);
  const [date, setDate] = useState(today);
  const [slipNumber, setSlipNumber] = useState("");
  // Kept by bill and gas, so that a row keeps its entry while the list is loaded again.
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  // How many saves have been tried, after any of which the rows may have changed.
  const [saves, setSaves] = useState(0);
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
    saves + retries,
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

  function choose(chosen: Choice | null) {
    setCustomer(chosen);
    setEntries({});
    setSlipNumber("");
    setAskedSplit(null);
    if (chosen) setReceived(undefined);
  }

  async function submit(): Promise<Outcome> {
    if (customer && dated && !rows) {
      return { error: "Wait for the pending cylinders to be listed, then save." };
    }
    setReceived(undefined);
    const { data, problem } = checkInput(newReturnSchema, {
      customerId: customer?.id ?? "",
      date,
      slipNumber,
      allocations: returning,
    });
    if (!data) {
      return { error: problem };
    }
    const answer = await saveReturn(data).catch(() => null);
    // Whatever came of it, the rows are asked for again.
    setSaves((count) => count + 1);
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
      <div role="status">{received && <Confirmation received={received} />}</div>
      <section onKeyDown={holdEnter} className="rounded-xl border border-slate-200 bg-white p-5">
        <ActionForm action={submit} submitLabel="Save returns">
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {/* On load only. After a save it would scroll the confirmation away. */}
              <CustomerPicker chosen={customer} onChoose={choose} focused={saves === 0} />
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
                      key={customer.id}
                      rows={rows ?? []}
                      customerName={customer.name}
                      asked={askedSplit}
                      answer={splitAnswer}
                      onFill={(gas, total) => {
                        setAskedSplit({ gas, total });
                        setSplitsAsked((count) => count + 1);
                      }}
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
                    key={customer.id}
                    customerId={customer.id}
                    date={date}
                    askAgain={saves}
                  />
                </>
              )}
            </div>
          </fieldset>
          <p aria-live="polite" className="text-sm text-amber-800 empty:hidden">
            {leftOut > 0 &&
              `Not included: ${leftOut} typed against what is no longer listed. Check the rows before saving.`}
          </p>
          <p aria-live="polite" className="text-right text-sm tabular-nums">
            <span className="text-slate-500">Returning now </span>
            <span className="font-semibold">
              {returning.reduce((total, { quantity }) => total + cylinders(String(quantity)), 0)}
            </span>
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
              label="Split state"
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

/** What was just saved: who returned how many, and against which bills. */
function Confirmation({
  received: { id, number, customer, quantity, bills },
}: {
  received: ReceivedReturn;
}) {
  const link = "font-medium underline";
  const shown = useRef<HTMLParagraphElement>(null);

  // The button that saved is at the foot of a form that may be long.
  useEffect(() => {
    shown.current?.scrollIntoView({ block: "nearest" });
  }, [id]);

  return (
    // The margin keeps it clear of the navigation bar, which stays at the top.
    <p
      ref={shown}
      className="scroll-mt-20 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 wrap-anywhere"
    >
      Saved{" "}
      <Link href={billPath(id)} className={link}>
        {number}
      </Link>
      : {customer.name} returned {quantity === 1 ? "1 cylinder" : `${quantity} cylinders`} against{" "}
      {bills.map((bill, index) => (
        <Fragment key={bill.id}>
          {index > 0 && (index === bills.length - 1 ? " and " : ", ")}
          <Link href={billPath(bill.id)} className={link}>
            {pendingBillName(bill)}
          </Link>
        </Fragment>
      ))}
      .
    </p>
  );
}
