"use client";

import {
  checkInput,
  FILL_STATES,
  newBillSchema,
  newCustomerWriteOffSchema,
  WRITE_OFF_REASONS,
  whyNotEnter,
  type Bill,
  type FillState,
  type Gas,
  type NewBill,
  type PaperKind,
  type PartyType,
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
import { BILL_TYPE_NAMES, FILL_STATE_NAMES, WRITE_OFF_REASON_NAMES } from "@/lib/bill-names";
import { holdEnter } from "@/lib/hold-enter";
import { billPath, BILLS_PATH } from "@/lib/routes";
import { useLastGiven } from "@/lib/use-last-given";
import { vehicleName } from "@/lib/vehicle-names";
import { CustomerPicker } from "../../returns/new/customer-picker";
import { correctBill } from "../actions";
import { saveBill, saveCustomerWriteOff } from "./actions";
import { BillNumberFields, RefillerSlipNumberField } from "./bill-number-fields";
import { NewPartyDialog } from "./new-party-dialog";
import { PartyPicker, type ChosenParty } from "./party-picker";
import { WrittenOffCylinders } from "./written-off-cylinders";

/** What the form offers, and the dates it starts from. */
export interface FormChoices {
  /** Whether to offer the types of bill that only admins enter. */
  isAdmin: boolean;
  startDate: string;
  today: string;
  gases: Gas[];
  vehicles: Vehicle[];
}

/** A bill of a type this form offers, to be corrected on it. */
export type FormBill = Bill & { type: NewBill["type"] };

/** How the form differs from one type of bill to another. */
const BILL_FORMS: Record<
  NewBill["type"],
  {
    /** The type of party it names beside the shop. */
    partyType: PartyType;
    /** Whether it may leave that party out. */
    partyOptional?: boolean;
    /** What each line shows until a fill state is chosen for it. */
    fillState: FillState;
    /** Whether it is copied from paper, which gives its number and may name a vehicle. */
    fromPaper: boolean;
  }
> = {
  dispatch: { partyType: "customer", fillState: "filled", fromPaper: true },
  send_to_refiller: { partyType: "refiller", fillState: "empty", fromPaper: true },
  return_from_refiller: { partyType: "refiller", fillState: "filled", fromPaper: true },
  add_cylinders: {
    partyType: "supplier",
    partyOptional: true,
    fillState: "empty",
    fromPaper: false,
  },
  write_off: { partyType: "refiller", fillState: "defective", fromPaper: false },
};

/**
 * Where a write-off can be from. A customer's is entered against one of their bills,
 * rather than as lines, and is never corrected.
 */
type WrittenOffFrom = "shop" | "refiller" | "customer";

export function BillForm({
  choices,
  bill,
}: {
  choices: FormChoices | null;
  /** The bill being corrected. Left out for a new one. */
  bill?: FormBill;
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
  choices: { isAdmin, startDate, today, gases, vehicles },
  bill,
}: {
  choices: FormChoices;
  bill?: FormBill;
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
  const [chosen, setChosen] = useState<Partial<Record<PartyType, ChosenParty | null>>>(() =>
    bill ? { [BILL_FORMS[bill.type].partyType]: namedOn(bill) } : {},
  );
  const [writtenOffFrom, setWrittenOffFrom] = useState<WrittenOffFrom>(
    bill?.from?.type === "refiller" ? "refiller" : "shop",
  );
  const [newName, setNewName] = useState("");
  const [lines, setLines] = useState(() => (bill ? asFormLines(bill.lines) : [blankLine(1)]));
  // How many saves have been turned down, each of which may mean the number is
  // taken, or that less is pending than was listed.
  const [refusals, setRefusals] = useState(0);
  const newParty = useRef<ActionDialogHandle>(null);
  const { partyOptional, fillState: defaultFillState, fromPaper } = BILL_FORMS[type];
  const fromCustomer = type === "write_off" && writtenOffFrom === "customer";
  const partyType = fromCustomer ? "customer" : BILL_FORMS[type].partyType;
  const party = chosen[partyType] ?? null;
  // A write-off from the shop names nobody else.
  const namesParty = type !== "write_off" || writtenOffFrom !== "shop";
  const choose = (party: ChosenParty | null) =>
    setChosen((chosen) => ({ ...chosen, [partyType]: party }));

  async function submit(form: FormData): Promise<Outcome> {
    const outcome = fromCustomer ? await submitWriteOff(form) : await submitLines(form);
    if (outcome.error) setRefusals((count) => count + 1);
    return outcome;
  }

  async function submitWriteOff(form: FormData): Promise<Outcome> {
    const { data, problem } = checkInput(newCustomerWriteOffSchema, {
      customerId: party?.id ?? "",
      // Absent while the pending cylinders are not listed.
      billId: form.get("billId") ?? "",
      gasId: form.get("gasId") ?? "",
      quantity: Number(form.get("quantity")),
      writeOffReason: form.get("writeOffReason"),
      date,
      notes: form.get("notes"),
    });
    return data ? saveCustomerWriteOff(data) : { error: problem };
  }

  async function submitLines(form: FormData): Promise<Outcome> {
    // The check leaves out whatever is no part of a bill of this type.
    const { data, problem } = checkInput(newBillSchema, {
      type,
      paperKind,
      number: type === "return_from_refiller" ? refillerSlipNumber : paperNumber,
      date,
      [`${partyType}Id`]: namesParty ? (party?.id ?? (partyOptional ? null : "")) : null,
      vehicleId: form.get("vehicleId") || null,
      writeOffReason: form.get("writeOffReason"),
      notes: form.get("notes"),
      lines: asNewLines(lines, defaultFillState),
    });
    if (!data) {
      return { error: problem };
    }
    return bill ? correctBill(bill.id, data) : saveBill(data);
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
                {(Object.keys(BILL_FORMS) as NewBill["type"][])
                  .filter((option) => !whyNotEnter(option, { isAdmin }))
                  .map((option) => (
                    <option key={option} value={option}>
                      {BILL_TYPE_NAMES[option]}
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
              fromPaper && (
                <BillNumberFields
                  paperKind={paperKind}
                  number={paperNumber}
                  onPaperKind={setPaperKind}
                  onNumber={setPaperNumber}
                  askAgain={refusals}
                  ownBillId={bill?.id}
                />
              )
            )}
            <BillDateField startDate={startDate} value={date} onChange={setDate} />
            {type === "write_off" && (
              <SelectField
                label="Written off from"
                required
                value={writtenOffFrom}
                onChange={(event) => setWrittenOffFrom(event.target.value as WrittenOffFrom)}
              >
                <option value="shop">The shop</option>
                <option value="refiller">A refiller</option>
                {/* No saved write-off can be corrected to be from a customer. */}
                {!bill && <option value="customer">A customer</option>}
              </SelectField>
            )}
            {fromCustomer ? (
              // Only a customer with cylinders pending has any to write off, so no
              // new one is offered.
              <CustomerPicker chosen={party} onChoose={choose} />
            ) : (
              namesParty && (
                <PartyPicker
                  key={partyType}
                  type={partyType}
                  chosen={party}
                  onChoose={choose}
                  onNew={(typed) => {
                    setNewName(typed);
                    newParty.current?.open();
                  }}
                  optional={partyOptional}
                />
              )
            )}
            {type === "write_off" && (
              <SelectField
                label="Reason"
                name="writeOffReason"
                required
                defaultValue={bill?.writeOffReason ?? ""}
              >
                <option value="">Choose a reason</option>
                {WRITE_OFF_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {WRITE_OFF_REASON_NAMES[reason]}
                  </option>
                ))}
              </SelectField>
            )}
            {fromPaper && (
              <SelectField label="Vehicle" name="vehicleId" defaultValue={bill?.vehicle?.id ?? ""}>
                <option value="">No vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)}
                  </option>
                ))}
              </SelectField>
            )}
            <div className="sm:col-span-2">
              <TextAreaField label="Notes" name="notes" defaultValue={bill?.notes ?? ""} />
            </div>
          </div>
          {fromCustomer ? (
            <fieldset className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
              <legend className="float-left w-full font-semibold">Pending cylinders</legend>
              <div className="clear-left">
                {!party ? (
                  <Note>Choose a customer to see what they have pending.</Note>
                ) : date < startDate ? (
                  <Note>
                    {date
                      ? "A write-off cannot be dated before the start date."
                      : "Choose the bill date."}
                  </Note>
                ) : (
                  <WrittenOffCylinders
                    key={party.id}
                    customer={party}
                    date={date}
                    askAgain={refusals}
                  />
                )}
              </div>
            </fieldset>
          ) : (
            <fieldset className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
              <legend className="float-left w-full font-semibold">Lines</legend>
              {lines.some((line) => line.optional) && (
                <p className="clear-left text-sm text-slate-500">
                  Leave the quantity blank for a gas that is not on the{" "}
                  {fromPaper ? "paper" : "bill"}.
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
          )}
        </ActionForm>
      </section>
      {/* Outside the bill's form, since one form cannot sit inside another. */}
      <NewPartyDialog ref={newParty} type={partyType} name={newName} onAdded={choose} />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

/** The party a bill names beside the shop, if any. */
function namedOn({ type, from, to }: FormBill): ChosenParty | null {
  const named = type === "dispatch" || type === "send_to_refiller" ? to : from;
  // A write-off may be from the shop.
  return named && named.type !== "shop" ? named : null;
}

/** The cylinders on the lines so far, to check against the paper or a count. */
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
