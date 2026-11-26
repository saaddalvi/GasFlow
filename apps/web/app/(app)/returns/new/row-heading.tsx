import { pendingBillName, type PendingRow } from "@gasflow/shared";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { billPath } from "@/lib/routes";

/** Which bill and gas a row of Receive empties is for. */
export function RowHeading({ row: { bill, gas } }: { row: PendingRow }) {
  return (
    <div className="min-w-0 wrap-anywhere">
      {/* In a new tab, so that what has been typed is not lost. */}
      <Link
        href={billPath(bill.id)}
        target="_blank"
        className="font-medium text-brand-700 hover:underline"
      >
        {pendingBillName(bill)}
        <span className="sr-only"> (opens in a new tab)</span>
      </Link>{" "}
      <span className="whitespace-nowrap text-slate-500">· {formatDate(bill.date)}</span>
      <p className="font-medium">{gas.name}</p>
    </div>
  );
}

/**
 * The cylinders a row sent, those since returned, those written off if any, and
 * those still pending.
 */
export function RowCounts({ row: { sent, returned, writtenOff, pending } }: { row: PendingRow }) {
  const counts: [label: string, count: number][] = [
    ["Sent", sent],
    ["Returned", returned],
    // Rarely any, so shown only when there are.
    ...(writtenOff > 0 ? [["Written off", writtenOff] as [string, number]] : []),
    ["Pending", pending],
  ];

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
      {counts.map(([label, count]) => (
        <div key={label}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className={label === "Pending" ? "font-semibold" : undefined}>{count}</dd>
        </div>
      ))}
    </dl>
  );
}
