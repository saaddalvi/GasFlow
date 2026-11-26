"use client";

import {
  checkInput,
  FILL_STATES,
  newBillSchema,
  type Bill,
  type FillState,
  type Gas,
  type NewBill,
  type PaperKind,
  type Vehicle,
} from "@gasflow/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ActionDialogHandle } from "@/components/action-dialog";
import { ActionForm } from "@/components/action-form";
import { BillDateField } from "@/components/bill-date-field";
import { buttonStyles } from "@/components/button-styles";
import { SelectField, TextAreaField } from "@/components/fields";
import {
  asFormLines,
  asNewLines,
  blankLine,
  LineList,
  nextKey,
  type FormLine,
} from "@/components/line-fields";
import { LoadError } from "@/components/load-error";
import type { Outcome } from "@/lib/api";
import { BILL_TYPE_NAMES, FILL_STATE_NAMES } from "@/lib/bill-names";
import { holdEnter } from "@/lib/hold-enter";
import { billPath, BILLS_PATH } from "@/lib/routes";
import { useLastGiven } from "@/lib/use-last-given";
import { vehicleName } from "@/lib/vehicle-names";
import { correctBill } from "../actions";
import { saveBill } from "./actions";
import { BillNumberFields, RefillerSlipNumberField } from "./bill-number-fields";
import { NewPartyDialog } from "./new-party-dialog";
import { PartyPicker, type ChosenParty, type PickableType } from "./party-picker";

/** What the form offers, and the dates it starts from. */
export interface FormChoices {
  startDate: string;
  today: string;
  gases: Gas[];
  vehicles: Vehicle[];
}

/** A bill of a type this form offers, to be corrected on it. */
export type PaperBill = Bill & { type: NewBill["type"] };

/** How the form differs from one type of bill to another. */
const BILL_FORMS: Record<NewBill["type"], { partyType: PickableType; fillState: FillState }> = {
  dispatch: { partyType: "customer", fillState: "filled" },
  send_to_refiller: { partyType: "refiller", fillState: "empty" },
  return_from_refiller: { partyType: "refiller", fillState: "filled" },
};

export function BillForm({
  choices,
  bill,
}: {
  choices: FormChoices | null;
  /** The bill being corrected. Left out for a new one. */
  bill?: PaperBill;
}) {
  const shown = useLastGiven(choices);

  return shown ? (
    <Form choices={shown} bill={bill} />
  ) : (
    <LoadError>
      The form could not be loaded. Check that the API is running, then reload the page.
    </LoadError>
  );
}

function Form({
  choices: { startDate, today, gases, vehicles },
  bill,
}: {
  choices: FormChoices;
  bill?: PaperBill;
}) {
  const router = useRouter();
  const [type, setType] = useState<NewBill["type"]>(bill?.type ?? "dispatch");
  const [paperKind, setPaperKind] = useState<PaperKind>(bill?.paperKind ?? "bill");
  // Kept apart, so that a number copied from one paper is not saved as the other's.
  const [paperNumber, setPaperNumber] = useState(bill?.paperKind ? bill.number : "");
  const [refillerSlipNumber, setRefillerSlipNumber] = useState(
    bill?.type === "return_from_refiller" ? bill.number : "",
  );
  const [date, setDate] = useState(bill?.date ?? today);
  // One of each type is remembered, in case the type is changed and changed back.
  const [chosen, setChosen] = useState<Partial<Record<PickableType, ChosenParty | null>>>(() =>
    bill ? { [BILL_FORMS[bill.type].partyType]: namedOn(bill) } : {},
  );
  const [newName, setNewName] = useState("");
  const [lines, setLines] = useState(() => (bill ? asFormLines(bill.lines) : [blankLine(1)]));
  // How many saves have been turned down, each of which may mean the number is taken.
  const [refusals, setRefusals] = useState(0);
  const newParty = useRef<ActionDialogHandle>(null);
  const { partyType, fillState: defaultFillState } = BILL_FORMS[type];
  const party = chosen[partyType] ?? null;
  const choose = (party: ChosenParty | null) =>
    setChosen((chosen) => ({ ...chosen, [partyType]: party }));

  async function submit(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newBillSchema, {
      type,
      // Not part of a return from refiller, which the check leaves out.
      paperKind,
      number: type === "return_from_refiller" ? refillerSlipNumber : paperNumber,
      date,
      [`${partyType}Id`]: party?.id ?? "",
      vehicleId: form.get("vehicleId") || null,
      notes: form.get("notes"),
      lines: asNewLines(lines, defaultFillState),
    });
    const outcome = !data
      ? { error: problem }
      : bill
        ? await correctBill(bill.id, data)
        : await saveBill(data);
    if (outcome.error) setRefusals((count) => count + 1);
    return outcome;
  }

  /** Adds a line for each gas that has none, in place of any left wholly blank. */
  function addEveryGas() {
    const kept = lines.filter((line) => line.gasId || line.quantity);
    const listed = new Set(kept.map((line) => line.gasId));
    const first = nextKey(lines);
    const added = gases
      // A retired gas is here only for a bill that already has it.
      .filter((gas) => gas.active && !listed.has(gas.id))
      .map((gas, index) => ({ ...blankLine(first + index), gasId: gas.id, optional: true }));
    if (added.length > 0) setLines([...kept, ...added]);
  }

  return (
    <div className="max-w-3xl">
      <section onKeyDown={holdEnter} className="rounded-xl border border-slate-200 bg-white p-5">
        <ActionForm
          action={submit}
          submitLabel={bill ? "Save correction" : "Save bill"}
          onCancel={() => router.push(bill ? billPath(bill.id) : BILLS_PATH)}
        >
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {/* A saved bill keeps its type. */}
            {!bill && (
              <SelectField
                label="Type"
                required
                value={type}
                onChange={(event) => setType(event.target.value as NewBill["type"])}
              >
                {Object.keys(BILL_FORMS).map((option) => (
                  <option key={option} value={option}>
                    {BILL_TYPE_NAMES[option as NewBill["type"]]}
                  </option>
                ))}
              </SelectField>
            )}
            {type === "return_from_refiller" ? (
              <RefillerSlipNumberField
                refiller={party}
                number={refillerSlipNumber}
                onNumber={setRefillerSlipNumber}
                askAgain={refusals}
                ownBillId={bill?.id}
              />
            ) : (
              <BillNumberFields
                paperKind={paperKind}
                number={paperNumber}
                onPaperKind={setPaperKind}
                onNumber={setPaperNumber}
                askAgain={refusals}
                ownBillId={bill?.id}
              />
            )}
            <BillDateField startDate={startDate} value={date} onChange={setDate} />
            <PartyPicker
              key={partyType}
              type={partyType}
              chosen={party}
              onChoose={choose}
              onNew={(typed) => {
                setNewName(typed);
                newParty.current?.open();
              }}
            />
            <SelectField label="Vehicle" name="vehicleId" defaultValue={bill?.vehicle?.id ?? ""}>
              <option value="">No vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleName(vehicle)}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <TextAreaField label="Notes" name="notes" defaultValue={bill?.notes ?? ""} />
            </div>
          </div>
          <fieldset className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
            <legend className="float-left w-full font-semibold">Lines</legend>
            {lines.some((line) => line.optional) && (
              <p className="clear-left text-sm text-slate-500">
                Leave the quantity blank for a gas that is not on the paper.
              </p>
            )}
            <LineList
              lines={lines}
              onChange={setLines}
              gases={gases}
              defaultFillState={defaultFillState}
            >
              <button type="button" onClick={addEveryGas} className={buttonStyles.secondary}>
                + One line per gas
              </button>
            </LineList>
            <Totals lines={lines} defaultFillState={defaultFillState} />
          </fieldset>
        </ActionForm>
      </section>
      {/* Outside the bill's form, since one form cannot sit inside another. */}
      <NewPartyDialog ref={newParty} type={partyType} name={newName} onAdded={choose} />
    </div>
  );
}

/** The customer or refiller a bill names. */
function namedOn({ type, from, to }: PaperBill): ChosenParty | null {
  return type === "return_from_refiller" ? from : to;
}

/** The cylinders on the lines so far, to check against the paper. */
function Totals({ lines, defaultFillState }: { lines: FormLine[]; defaultFillState: FillState }) {
  // A quantity counts once it is one the bill could be saved with.
  const counted = lines.map((line) => {
    const quantity = Number(line.quantity);
    return {
      fillState: line.fillState ?? defaultFillState,
      quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 0,
    };
  });
  const sum = (of: typeof counted) => of.reduce((total, line) => total + line.quantity, 0);
  const totals = [
    ...FILL_STATES.map((fillState) => ({
      label: FILL_STATE_NAMES[fillState],
      count: sum(counted.filter((line) => line.fillState === fillState)),
      // Defective cylinders are seldom on a bill, so are counted only when some are.
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
