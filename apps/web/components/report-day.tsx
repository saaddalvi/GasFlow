import { addDays } from "@gasflow/shared";
import Form from "next/form";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/fields";
import { formatDate } from "@/lib/dates";
import { OPENING_STOCK_PATH } from "@/lib/routes";

// What the reports of one day have in common.

/** The address of a report on a date. */
export function reportDayHref(path: string, date: string): string {
  return `${path}?date=${date}`;
}

/** Chooses a report's day: by date or one day at a time, with any shortcuts below. */
export function ReportDayPicker({
  path,
  date,
  children,
}: {
  /** The report's own address. */
  path: string;
  date: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Starts afresh when the date changes, so that the box matches it. */}
        <Form key={date} action={path} className="flex items-end gap-3">
          <Field label="Date" name="date" type="date" defaultValue={date} required />
          <button type="submit" className={buttonStyles.secondary}>
            Apply
          </button>
        </Form>
        <nav aria-label="Days" className="flex gap-2">
          <Link href={reportDayHref(path, addDays(date, -1))} className={buttonStyles.secondary}>
            Previous day
          </Link>
          <Link href={reportDayHref(path, addDays(date, 1))} className={buttonStyles.secondary}>
            Next day
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}

/** In place of a report of a day there are no records for. */
export function NoRecords({ startDate }: { startDate: string | null }) {
  if (!startDate) {
    return (
      <EmptyState>
        There is nothing to show until the start date is set, on the{" "}
        <Link href={OPENING_STOCK_PATH} className="text-brand-700 underline">
          Opening stock
        </Link>{" "}
        page.
      </EmptyState>
    );
  }
  return <EmptyState>The records begin on {formatDate(startDate)}.</EmptyState>;
}
