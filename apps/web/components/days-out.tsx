import { Tag } from "./tag";

/** Marks out a row whose cylinders are overdue, beside the tag that says so. */
export const OVERDUE_ROW = "bg-rose-50";

/** How long a row's pending cylinders have been out, and whether that is too long. */
export function DaysOut({ daysOut, overdue }: { daysOut: number; overdue: boolean }) {
  return (
    <p className="text-right text-slate-500 md:text-left">
      <span className="whitespace-nowrap tabular-nums">
        {daysOut === 1 ? "1 day out" : `${daysOut} days out`}
      </span>
      {overdue && (
        <span className="block md:ml-2 md:inline">
          <Tag colour="rose">Overdue</Tag>
        </span>
      )}
    </p>
  );
}
