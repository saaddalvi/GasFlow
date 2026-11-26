"use client";

import { pendingBillName, pendingListSchema } from "@gasflow/shared";
import { useState } from "react";
import { Field, SelectField } from "@/components/fields";
import { LoadState } from "@/components/load-state";
import { formatDate } from "@/lib/dates";
import { RECEIVE_EMPTIES_PATH } from "@/lib/routes";
import { useLookup } from "@/lib/use-lookup";

/**
 * Which of a customer's pending cylinders to write off: a bill, a gas on it and
 * how many. The bills offered are those with cylinders pending that are dated on or
 * before the write-off. Its form gets them as `billId`, `gasId` and `quantity`.
 * Give it a key of its customer, so that nothing chosen for one is left for another.
 */
export function WrittenOffCylinders({
  customer,
  date,
  askAgain,
}: {
  customer: { id: string; name: string };
  date: string;
  /** Changes when the bills may have changed. */
  askAgain: number;
}) {
  const [retries, setRetries] = useState(0);
  const [billId, setBillId] = useState("");
  const [gasId, setGasId] = useState("");
  // What was typed, and the bill and gas it was typed for.
  const [typed, setTyped] = useState({ quantity: "", for: "" });
  const query = new URLSearchParams({ customerId: customer.id, date });
  const answer = useLookup(
    `${RECEIVE_EMPTIES_PATH}/pending?${query.toString()}`,
    pendingListSchema,
    askAgain + retries,
  );
  const rows = answer?.data?.rows;

  if (!rows) {
    return (
      <LoadState
        what="pending cylinders"
        failed={answer?.failed}
        onRetry={() => setRetries(retries + 1)}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nothing is pending from {customer.name} on this date.
      </p>
    );
  }
  // Each bill once, in the rows' order.
  const bills = [...new Map(rows.map(({ bill }) => [bill.id, bill])).values()];
  // A bill chosen earlier may have nothing pending by now, and then none is chosen.
  const onBill = rows.filter((row) => row.bill.id === billId);
  // The only gas of a bill needs no choosing. One chosen that is no longer pending
  // leaves none chosen, rather than whichever is left.
  const row = gasId
    ? onBill.find((other) => other.gas.id === gasId)
    : onBill.length === 1
      ? onBill[0]
      : undefined;
  const typingFor = row ? `${row.bill.id} ${row.gas.id}` : "";
  // A quantity typed for other cylinders is not carried over to these.
  const quantity = typed.for === typingFor ? typed.quantity : "";

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <SelectField
          label="Bill"
          name="billId"
          required
          value={onBill.length > 0 ? billId : ""}
          onChange={(event) => {
            setBillId(event.target.value);
            setGasId("");
          }}
        >
          <option value="">Choose a bill</option>
          {bills.map((bill) => (
            <option key={bill.id} value={bill.id}>
              {pendingBillName(bill)} · {formatDate(bill.date)}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField
        label="Gas"
        name="gasId"
        required
        value={row?.gas.id ?? ""}
        onChange={(event) => setGasId(event.target.value)}
      >
        <option value="">Choose a gas</option>
        {onBill.map(({ gas, pending }) => (
          <option key={gas.id} value={gas.id}>
            {gas.name} · {pending} pending
          </option>
        ))}
      </SelectField>
      <Field
        label="Quantity"
        name="quantity"
        type="number"
        inputMode="numeric"
        required
        min={1}
        max={row?.pending}
        step={1}
        value={quantity}
        onChange={(event) => setTyped({ quantity: event.target.value, for: typingFor })}
        hint={row && `At most ${row.pending}, which is all that is pending.`}
      />
    </div>
  );
}
