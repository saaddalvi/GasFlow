import { pendingBillName, type PendingReturn } from "@gasflow/shared";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { billPath } from "@/lib/routes";
import { DaysOut, OVERDUE_ROW } from "./days-out";

/** One customer's cylinders of a gas still out on one bill, as a row of a list. */
export function PendingItem({
  row: { bill, gas, daysOut, overdue },
  count,
  customer,
  action,
}: {
  row: Pick<PendingReturn, "bill" | "gas" | "daysOut" | "overdue">;
  /** How many are out, in words. */
  count: string;
  /** Whose they are, where the list is of more than one customer's. */
  customer?: React.ReactNode;
  /** What can be done about them. */
  action?: React.ReactNode;
}) {
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-5 py-3 first:rounded-t-xl last:rounded-b-xl md:items-center ${
        action
          ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem_9rem]"
          : "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem]"
      } ${overdue ? OVERDUE_ROW : ""}`}
    >
      {/* The whole width of a phone, so that a long name or number is not squeezed. */}
      <div className="col-span-2 min-w-0 wrap-anywhere md:col-span-1">
        {customer}
        <p>
          <Link href={billPath(bill.id)} className="text-brand-700 hover:underline">
            {pendingBillName(bill)}
          </Link>{" "}
          <span className="whitespace-nowrap text-slate-500">· {formatDate(bill.date)}</span>
        </p>
      </div>
      <p className="min-w-0 wrap-anywhere">
        <span className="font-medium">{gas.name}</span>
        <span className="block tabular-nums">{count}</span>
      </p>
      <DaysOut daysOut={daysOut} overdue={overdue} />
      {action && <div className="col-span-2 justify-self-end md:col-span-1">{action}</div>}
    </li>
  );
}
