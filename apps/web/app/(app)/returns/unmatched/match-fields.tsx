"use client";

import { pendingBillName, pendingListSchema, type UnmatchedRow } from "@gasflow/shared";
import Link from "next/link";
import { useState } from "react";
import { Field, SelectField } from "@/components/fields";
import { LoadState } from "@/components/load-state";
import { formatDate } from "@/lib/dates";
import { NEW_BILL_PATH, RECEIVE_EMPTIES_PATH } from "@/lib/routes";
import { useLookup } from "@/lib/use-lookup";

/**
 * Which bill to match unmatched cylinders to, and how many. The bills offered are
 * those with the gas pending that are dated on or before the return.
 */
export function MatchFields({
  row: { return: returned, customer, gas, quantity },
  askAgain,
}: {
  row: UnmatchedRow;
  /** Changes when the bills may have changed. */
  askAgain: number;
}) {
  const [retries, setRetries] = useState(0);
  // Null until staff choose, which offers the oldest bill.
  const [chosen, setChosen] = useState<string | null>(null);
  // Null until staff type, which offers as many as fit.
  const [typed, setTyped] = useState<string | null>(null);
  const query = new URLSearchParams({ customerId: customer.id, date: returned.date });
  const answer = useLookup(
    `${RECEIVE_EMPTIES_PATH}/pending?${query.toString()}`,
    pendingListSchema,
    askAgain + retries,
  );
  const rows = answer?.data?.rows.filter((row) => row.gas.id === gas.id);

  if (!rows) {
    return (
      <LoadState
        what="pending bills"
        failed={answer?.failed}
        onRetry={() => setRetries(retries + 1)}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {customer.name} has no {gas.name} pending on a bill dated on or before{" "}
        {formatDate(returned.date)}. If a dispatch bill is missing,{" "}
        <Link href={NEW_BILL_PATH} className="text-brand-700 underline">
          enter it
        </Link>{" "}
        first.
      </p>
    );
  }
  // A bill chosen earlier may have nothing pending by now, and then none is chosen.
  const row = chosen === null ? rows[0] : rows.find((other) => other.bill.id === chosen);
  const most = row ? Math.min(quantity, row.pending) : quantity;

  return (
    <>
      <SelectField
        label="Bill"
        name="billId"
        required
        value={row?.bill.id ?? ""}
        onChange={(event) => {
          setChosen(event.target.value);
          setTyped(null);
        }}
      >
        <option value="">Choose a bill</option>
        {rows.map(({ bill, pending }) => (
          <option key={bill.id} value={bill.id}>
            {pendingBillName(bill)} · {formatDate(bill.date)} · {pending} pending
          </option>
        ))}
      </SelectField>
      {row && <input type="hidden" name="billName" value={pendingBillName(row.bill)} />}
      <Field
        label="Quantity"
        name="quantity"
        type="number"
        inputMode="numeric"
        required
        min={1}
        max={most}
        step={1}
        value={typed ?? String(most)}
        onChange={(event) => setTyped(event.target.value)}
      />
    </>
  );
}
