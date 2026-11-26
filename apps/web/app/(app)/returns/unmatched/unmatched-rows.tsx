"use client";

import { checkInput, newMatchSchema, type UnmatchedList, type UnmatchedRow } from "@gasflow/shared";
import Link from "next/link";
import { useRef, useState } from "react";
import { ActionDialog, type ActionDialogHandle } from "@/components/action-dialog";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/load-error";
import { EmptyPage, Pagination } from "@/components/pagination";
import type { Outcome } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { billPath, UNMATCHED_RETURNS_PATH } from "@/lib/routes";
import { useLastGiven } from "@/lib/use-last-given";
import { matchToBill } from "./actions";
import { MatchFields } from "./match-fields";

const keyOf = (row: UnmatchedRow) => `${row.return.id} ${row.gas.id}`;

const pageHref = (page: number) => `${UNMATCHED_RETURNS_PATH}?page=${page}`;

/** The unmatched cylinders, each with the way to match them to a bill. */
export function UnmatchedRows({ list }: { list: UnmatchedList | null }) {
  const shown = useLastGiven(list);
  // The row whose box was opened last.
  const [opened, setOpened] = useState<UnmatchedRow>();
  // How many matches have been tried, after any of which the bills may have changed.
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState<string>();
  const dialog = useRef<ActionDialogHandle>(null);
  // As the page last gave it. A row matched in full is no longer listed.
  const listed = opened && shown?.rows.find((row) => keyOf(row) === keyOf(opened));
  const matching = listed ?? opened;

  async function submit(form: FormData): Promise<Outcome> {
    if (!matching) return {};
    const { data, problem } = checkInput(newMatchSchema, {
      billId: form.get("billId") ?? "",
      gasId: matching.gas.id,
      quantity: Number(form.get("quantity")),
    });
    if (!data) {
      return { error: problem };
    }
    const outcome = await matchToBill(matching.return.id, data);
    setTries((count) => count + 1);
    if (!outcome.error) {
      setDone(
        `Matched ${data.quantity} ${matching.gas.name} on ${matching.return.number} to ${form.get("billName") as string}.`,
      );
    }
    return outcome;
  }

  return (
    <div className="space-y-3">
      {/* Always here, so that what appears in it is read out. */}
      <div role="status">
        {done && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 wrap-anywhere">
            {done}
          </p>
        )}
      </div>
      {!shown ? (
        <LoadError>
          The unmatched returns could not be loaded. Check that the API is running, then reload the
          page.
        </LoadError>
      ) : shown.total === 0 ? (
        <EmptyState>No returned cylinders are unmatched.</EmptyState>
      ) : shown.rows.length === 0 ? (
        <EmptyPage firstPageHref={pageHref(1)} />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {shown.rows.map((row) => (
              <Row
                key={keyOf(row)}
                row={row}
                onMatch={() => {
                  setOpened(row);
                  setDone(undefined);
                  dialog.current?.open();
                }}
              />
            ))}
          </ul>
          <Pagination
            page={shown.page}
            pageSize={shown.pageSize}
            shown={shown.rows.length}
            total={shown.total}
            pageHref={pageHref}
          />
        </>
      )}
      {/* One box for all the rows, so that it stays open if its row leaves the list. */}
      <ActionDialog
        ref={dialog}
        title="Match to bill"
        description={matching ? dialogDescription(matching, Boolean(listed)) : ""}
        submitLabel="Match"
        action={submit}
      >
        {matching && <MatchFields row={matching} askAgain={tries} />}
      </ActionDialog>
    </div>
  );
}

/** What the box says it is matching. */
function dialogDescription(
  { return: returned, customer, gas, quantity }: UnmatchedRow,
  /** Whether the row is still on the page, and so its count still true. */
  listed: boolean,
): string {
  return listed
    ? `${quantity} ${gas.name} unmatched on ${returned.number}, which ${customer.name} returned on ${formatDate(returned.date)}.`
    : `The ${gas.name} on ${returned.number} is no longer listed here.`;
}

function Row({ row, onMatch }: { row: UnmatchedRow; onMatch: () => void }) {
  const { return: returned, customer, gas, quantity } = row;

  return (
    <li className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 wrap-anywhere">
        <Link href={`/parties/${customer.id}`} className="font-medium hover:underline">
          {customer.name}
        </Link>
        <p>
          <Link
            href={billPath(returned.id)}
            className="text-brand-700 tabular-nums hover:underline"
          >
            {returned.number}
          </Link>{" "}
          <span className="whitespace-nowrap text-slate-500">· {formatDate(returned.date)}</span>
        </p>
      </div>
      <p className="min-w-0 wrap-anywhere">
        <span className="font-medium">{gas.name}</span>
        <span className="block tabular-nums">{quantity} unmatched</span>
      </p>
      <button
        type="button"
        onClick={onMatch}
        className={`${buttonStyles.secondary} justify-self-start`}
      >
        Match to bill
        <span className="sr-only">
          : {gas.name} on {returned.number}
        </span>
      </button>
    </li>
  );
}
