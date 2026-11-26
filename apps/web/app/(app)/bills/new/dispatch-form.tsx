"use client";

import {
  checkInput,
  FILL_STATES,
  newDispatchSchema,
  type Gas,
  type PaperKind,
  type Vehicle,
} from "@gasflow/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ActionDialogHandle } from "@/components/action-dialog";
import { ActionForm } from "@/components/action-form";
import { buttonStyles } from "@/components/button-styles";
import { Field, SelectField, TextAreaField } from "@/components/fields";
import { asNewLines, blankLine, LineList, nextKey, type FormLine } from "@/components/line-fields";
import { LoadError } from "@/components/load-error";
import type { Outcome } from "@/lib/api";
import { FILL_STATE_NAMES } from "@/lib/bill-names";
import { formatDate, formatDateInFull } from "@/lib/dates";
import { BILLS_PATH } from "@/lib/routes";
import { vehicleName } from "@/lib/vehicle-names";
import { saveBill } from "./actions";
import { BillNumberFields } from "./bill-number-fields";
import { CustomerPicker, type ChosenCustomer } from "./customer-picker";
import { NewCustomerDialog } from "./new-customer-dialog";

/** What the form offers, and the dates it starts from. */
export interface FormChoices {
  startDate: string;
  today: string;
  gases: Gas[];
  vehicles: Vehicle[];
}

export function DispatchForm({ choices }: { choices: FormChoices | null }) {
  // The page loads again after a refusal. Should that fail, the form keeps what it
  // had, so that a bill being entered is not lost.
  const [held, setHeld] = useState(choices);
  if (choices && choices !== held) setHeld(choices);
  const shown = choices ?? held;

  return shown ? (
    <Form choices={shown} />
  ) : (
    <LoadError>
      The form could not be loaded. Check that the API is running, then reload the page.
    </LoadError>
  );
}

function Form({ choices: { startDate, today, gases, vehicles } }: { choices: FormChoices }) {
  const router = useRouter();
  const [paperKind, setPaperKind] = useState<PaperKind>("bill");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today);
  const [customer, setCustomer] = useState<ChosenCustomer | null>(null);
  const [newName, setNewName] = useState("");
  const [lines, setLines] = useState(() => [blankLine(1)]);
  // How many saves have been turned down, each of which may mean the number is taken.
  const [refusals, setRefusals] = useState(0);
  const newCustomer = useRef<ActionDialogHandle>(null);

  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newDispatchSchema, {
      type: "dispatch",
      paperKind,
      number,
      date,
      customerId: customer?.id ?? "",
      vehicleId: form.get("vehicleId") || null,
      notes: form.get("notes"),
      lines: asNewLines(lines),
    });
    const outcome = data ? await saveBill(data) : { error: problem };
    if (outcome.error) setRefusals((count) => count + 1);
    return outcome;
  }

  /** Adds a line for each gas that has none, in place of any left wholly blank. */
  function addEveryGas() {
    const kept = lines.filter((line) => line.gasId || line.quantity);
    const listed = new Set(kept.map((line) => line.gasId));
    const first = nextKey(lines);
    const added = gases
      .filter((gas) => !listed.has(gas.id))
      .map((gas, index) => ({ ...blankLine(first + index), gasId: gas.id, optional: true }));
    if (added.length > 0) setLines([...kept, ...added]);
  }

  // Only the "Save bill" button saves. Enter in a box, which is easily pressed
  // halfway through a bill, does nothing.
  function holdEnter(event: React.KeyboardEvent) {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  }

  return (
    <div className="max-w-3xl">
      <section onKeyDown={holdEnter} className="rounded-xl border border-slate-200 bg-white p-5">
        <ActionForm
          action={submit}
          submitLabel="Save bill"
          onCancel={() => router.push(BILLS_PATH)}
        >
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <BillNumberFields
              paperKind={paperKind}
              number={number}
              onPaperKind={setPaperKind}
              onNumber={setNumber}
              askAgain={refusals}
            />
            <div>
              <Field
                label="Date"
                type="date"
                required
                min={startDate}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                hint={`Records begin on ${formatDate(startDate)}.`}
              />
              {/* To check against the paper. */}
              <p aria-live="polite" className="mt-1 text-sm font-medium empty:hidden">
                {date && formatDateInFull(date)}
              </p>
            </div>
            <CustomerPicker
              chosen={customer}
              onChoose={setCustomer}
              onNew={(typed) => {
                setNewName(typed);
                newCustomer.current?.open();
              }}
            />
            <SelectField label="Vehicle" name="vehicleId" defaultValue="">
              <option value="">No vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleName(vehicle)}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <TextAreaField label="Notes" name="notes" />
            </div>
          </div>
          <fieldset className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
            <legend className="float-left w-full font-semibold">Lines</legend>
            {lines.some((line) => line.optional) && (
              <p className="clear-left text-sm text-slate-500">
                Leave the quantity blank for a gas that is not on the paper.
              </p>
            )}
            <LineList lines={lines} onChange={setLines} gases={gases}>
              <button type="button" onClick={addEveryGas} className={buttonStyles.secondary}>
                + One line per gas
              </button>
            </LineList>
            <Totals lines={lines} />
          </fieldset>
        </ActionForm>
      </section>
      {/* Outside the bill's form, since one form cannot sit inside another. */}
      <NewCustomerDialog ref={newCustomer} name={newName} onAdded={setCustomer} />
    </div>
  );
}

/** The cylinders on the lines so far, to check against the paper. */
function Totals({ lines }: { lines: FormLine[] }) {
  // A quantity counts once it is one the bill could be saved with.
  const counted = lines.map((line) => {
    const quantity = Number(line.quantity);
    return { ...line, quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 0 };
  });
  const sum = (of: typeof counted) => of.reduce((total, line) => total + line.quantity, 0);
  const totals = [
    ...FILL_STATES.map((fillState) => ({
      label: FILL_STATE_NAMES[fillState],
      count: sum(counted.filter((line) => line.fillState === fillState)),
      // Defective cylinders seldom leave the shop, so are shown only when some do.
      hiddenAtNone: fillState === "defective",
    })),
    { label: "Total", count: sum(counted), hiddenAtNone: false },
  ];

  return (
    <dl aria-live="polite" className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
      {totals
        .filter((total) => total.count > 0 || !total.hiddenAtNone)
        .map(({ label, count }) => (
          <div key={label} className="flex gap-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold">{count}</dd>
          </div>
        ))}
    </dl>
  );
}
