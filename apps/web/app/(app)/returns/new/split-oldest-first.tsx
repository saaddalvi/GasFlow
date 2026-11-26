"use client";

import { checkInput, splitQuerySchema, type Split, type PendingList } from "@gasflow/shared";
import { useState } from "react";
import { buttonStyles } from "@/components/button-styles";
import { Field, SelectField } from "@/components/fields";
import type { FormLine } from "@/components/line-fields";
import type { Lookup } from "@/lib/use-lookup";

/** The total of one gas that staff asked to have spread over the oldest bills. */
export interface AskedSplit {
  gas: { id: string; name: string };
  total: number;
}

const countOf = (count: number) => (count === 1 ? "1 cylinder" : `${count} cylinders`);

/**
 * One total for a gas, which the API splits across the oldest bills of that gas.
 * The split is put in the rows, where it can be changed before saving.
 */
export function FillOldestFirst({
  rows,
  customerName,
  asked,
  answer,
  onFill,
  ...excess
}: {
  rows: PendingList["rows"];
  customerName: string;
  asked: AskedSplit | null;
  answer: Lookup<Split> | undefined;
  onFill: (gas: AskedSplit["gas"], total: number) => void;
} & ExcessProps) {
  const gases = [...new Map(rows.map(({ gas }) => [gas.id, gas])).values()];
  const [chosen, setChosen] = useState("");
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string>();
  const gas = gases.find((other) => other.id === chosen) ?? gases[0];

  function fill() {
    if (!gas) return;
    const checked = checkInput(splitQuerySchema.shape.total, typed);
    setProblem(checked.problem);
    if (checked.data !== undefined) onFill(gas, checked.data);
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      {gas && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,5rem)] items-end gap-2 sm:grid-cols-[minmax(0,14rem)_6rem_auto] sm:justify-start">
          <SelectField
            label="Gas"
            value={gas.id}
            onChange={(event) => setChosen(event.target.value)}
          >
            {gases.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </SelectField>
          <Field
            label="Total"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") fill();
            }}
          />
          <button
            type="button"
            onClick={fill}
            className={`${buttonStyles.secondary} col-span-2 whitespace-nowrap sm:col-span-1`}
          >
            Fill oldest first
          </button>
        </div>
      )}
      <p aria-live="polite" className="text-sm text-rose-700 empty:hidden">
        {problem}
      </p>
      {/* Kept while a total is wrong, as the rows still hold the last split. */}
      <p aria-live="polite" className="text-sm empty:hidden">
        {asked && <Outcome asked={asked} answer={answer} customerName={customerName} />}
      </p>
      {asked && answer?.data && answer.data.excess > 0 && (
        <Excess gas={asked.gas} count={answer.data.excess} {...excess} />
      )}
    </div>
  );
}

/** What is needed to leave unmatched what a fill could not place. */
interface ExcessProps {
  /** The rows under unmatched cylinders. */
  unmatched: FormLine[];
  canLeaveUnmatched: (gasId: string) => boolean;
  onLeaveUnmatched: (gasId: string, quantity: number) => void;
}

/** The way to keep the cylinders a fill left over, which are saved only if kept. */
function Excess({
  gas,
  count,
  unmatched,
  canLeaveUnmatched,
  onLeaveUnmatched,
}: ExcessProps & { gas: AskedSplit["gas"]; count: number }) {
  const kept = unmatched
    .filter((line) => line.gasId === gas.id)
    .reduce((total, line) => total + Number(line.quantity), 0);
  if (!canLeaveUnmatched(gas.id)) {
    return (
      <p className="text-sm text-amber-800">
        {gas.name} is retired, so none can be saved as unmatched until an admin brings it back.
      </p>
    );
  }
  return (
    <p aria-live="polite" className="text-sm">
      {kept === count ? (
        <span className="text-slate-600">
          {countOf(count)} of {gas.name} {count === 1 ? "is" : "are"} under Unmatched cylinders.
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onLeaveUnmatched(gas.id, count)}
          className={buttonStyles.secondary}
        >
          Add {count} {gas.name} as unmatched
        </button>
      )}
    </p>
  );
}

/** What came of the last fill. Cylinders it could not place are always named. */
function Outcome({
  asked: { gas, total },
  answer,
  customerName,
}: {
  asked: AskedSplit;
  answer: Lookup<Split> | undefined;
  customerName: string;
}) {
  if (answer?.failed) {
    return (
      <span className="text-amber-800">
        The split could not be worked out. Check that the API is running, then fill again.
      </span>
    );
  }
  if (!answer?.data) {
    return <span className="text-slate-500">Filling {gas.name}…</span>;
  }
  const { rows, excess } = answer.data;
  if (excess === 0) {
    return (
      <span className="text-slate-600">
        Filled {countOf(total)} of {gas.name} across{" "}
        {rows.length === 1 ? "1 bill" : `${rows.length} bills`}, the oldest first. Change any row
        before saving.
      </span>
    );
  }
  return (
    <span className="text-amber-800">
      {rows.length === 0
        ? `None of the ${countOf(total)} of ${gas.name} were filled: ${customerName} has none pending on this date.`
        : `Filled ${total - excess} of ${total} ${gas.name}. The other ${excess} are more than ${customerName} has pending on this date, and are not in the rows above.`}
    </span>
  );
}
