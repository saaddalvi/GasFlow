"use client";

import { FILL_STATES, type FillState, type Gas } from "@gasflow/shared";
import { FILL_STATE_NAMES } from "@/lib/bill-names";
import { buttonStyles } from "./button-styles";
import { Field, SelectField } from "./fields";

/** A line of a bill as it stands on a form, whatever has been filled in so far. */
export interface FormLine {
  /** Stays with the line when others are removed. */
  key: number;
  gasId: string;
  /** Left out until one is chosen, so that the line takes the bill's usual one. */
  fillState?: FillState;
  quantity: string;
  /**
   * Set on a line the form filled in by itself, which may be left as it is and is
   * then not part of the bill. Changing the line makes it like any other.
   */
  optional?: boolean;
}

export function blankLine(key: number): FormLine {
  return { key, gasId: "", quantity: "" };
}

/** A key that none of these lines has. */
export function nextKey(lines: FormLine[]): number {
  return Math.max(0, ...lines.map((line) => line.key)) + 1;
}

/** The lines the bill is to have, as a request carries them, yet to be checked. */
export function asNewLines(lines: FormLine[], defaultFillState: FillState) {
  return lines
    .filter((line) => !line.optional)
    .map(({ gasId, fillState = defaultFillState, quantity }) => ({
      gasId,
      fillState,
      quantity: Number(quantity),
    }));
}

/** The lines on a form, with the ways to change, remove and add them. */
export function LineList({
  lines,
  onChange,
  gases,
  defaultFillState,
  children,
}: {
  lines: FormLine[];
  onChange: (lines: FormLine[]) => void;
  gases: Gas[];
  /** What a line shows until a fill state is chosen for it. */
  defaultFillState: FillState;
  /** Further buttons, beside the one that adds a line. */
  children?: React.ReactNode;
}) {
  return (
    <>
      <ol className="clear-left space-y-3">
        {lines.map((line, index) => (
          <li key={line.key}>
            <LineFields
              line={line}
              position={index + 1}
              gases={gases}
              defaultFillState={defaultFillState}
              onChange={(changed) =>
                onChange(
                  lines.map((other) =>
                    other.key === line.key ? { ...changed, optional: false } : other,
                  ),
                )
              }
              onRemove={
                lines.length > 1
                  ? () => onChange(lines.filter((other) => other.key !== line.key))
                  : undefined
              }
            />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...lines, blankLine(nextKey(lines))])}
          className={buttonStyles.secondary}
        >
          + Add line
        </button>
        {children}
      </div>
    </>
  );
}

/** The gas, fill state and quantity of one line, and the way to remove it. */
function LineFields({
  line,
  position,
  gases,
  defaultFillState,
  onChange,
  onRemove,
}: {
  line: FormLine;
  /** The line's place on the form, counted from 1. */
  position: number;
  gases: Gas[];
  defaultFillState: FillState;
  onChange: (line: FormLine) => void;
  /** Left out when the line cannot be removed. */
  onRemove?: () => void;
}) {
  return (
    // Two columns on a phone, so that what is chosen can be read. All of them may
    // shrink below their contents, so as to fit.
    <fieldset className="grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <legend className="sr-only">Line {position}</legend>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <SelectField
          label="Gas"
          required
          value={line.gasId}
          onChange={(event) => onChange({ ...line, gasId: event.target.value })}
        >
          <option value="">Choose a gas</option>
          {gases.map((gas) => (
            <option key={gas.id} value={gas.id}>
              {gas.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="min-w-0">
        <SelectField
          label="Fill state"
          value={line.fillState ?? defaultFillState}
          onChange={(event) => onChange({ ...line, fillState: event.target.value as FillState })}
        >
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
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required={!line.optional}
          value={line.quantity}
          onChange={(event) => onChange({ ...line, quantity: event.target.value })}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!onRemove}
        className={`${buttonStyles.secondary} col-span-2 justify-self-start sm:col-span-1`}
      >
        Remove<span className="sr-only"> line {position}</span>
      </button>
    </fieldset>
  );
}
