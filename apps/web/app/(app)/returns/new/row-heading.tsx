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

/** The cylinders a row sent, those since returned and those still pending. */
export function RowCounts({ row: { sent, returned, pending } }: { row: PendingRow }) {
  return (
    <dl className="flex gap-4 tabular-nums">
      {(
        [
          ["Sent", sent],
          ["Returned", returned],
          ["Pending", pending],
        ] as const
      ).map(([label, count]) => (
        <div key={label}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className={label === "Pending" ? "font-semibold" : undefined}>{count}</dd>
        </div>
      ))}
    </dl>
  );
}
