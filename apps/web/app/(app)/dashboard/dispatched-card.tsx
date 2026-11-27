import type { Dashboard, DispatchedDay } from "@gasflow/shared";
import Link from "next/link";
import { formatDate, formatDayAndMonth, formatShortWeekday, formatWeekday } from "@/lib/dates";
import { billsOfDayHref, called, counted, GasChips, postedBillsHref } from "./parts";

/** What has been dispatched today, set beside last week and last month. */
export function DispatchedCard({
  date,
  startDate,
  dispatched,
  className = "",
}: {
  date: string;
  /** Nothing earlier can be compared with. */
  startDate: string;
  dispatched: Dashboard["dispatched"];
  className?: string;
}) {
  const { quantity, customers, gases, lastWeek, days, thisMonth, lastMonth } = dispatched;

  return (
    <div
      className={`min-w-0 space-y-5 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 ${className}`}
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
          />
          Dispatched today
        </h3>
        <Link href={billsOfDayHref("dispatch", date)} className="group block w-fit max-w-full">
          <span className="block text-6xl font-bold tracking-tight tabular-nums wrap-anywhere group-hover:underline">
            {quantity}
          </span>
          <span className="block text-sm text-slate-500">
            {called(quantity, "cylinder")} to {counted(customers, "customer")}
          </span>
          <GasChips gases={gases} />
        </Link>
        <LastWeek quantity={quantity} lastWeek={lastWeek} startDate={startDate} />
      </div>
      <Strip days={days} startDate={startDate} />
      <MonthToDate thisMonth={thisMonth} lastMonth={lastMonth} startDate={startDate} />
    </div>
  );
}

/** How today stands against the same weekday a week ago. */
function LastWeek({
  quantity,
  lastWeek,
  startDate,
}: {
  quantity: number;
  lastWeek: DispatchedDay;
  startDate: string;
}) {
  const weekday = formatWeekday(lastWeek.date);
  if (lastWeek.date < startDate) {
    return <p className="mt-2 text-sm text-slate-500">No records for last {weekday}.</p>;
  }
  const change = quantity - lastWeek.quantity;
  const colours =
    change > 0
      ? "bg-emerald-100 text-emerald-800"
      : change < 0
        ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-600";
  return (
    <Link
      href={billsOfDayHref("dispatch", lastWeek.date)}
      className="mt-2 flex w-fit max-w-full flex-wrap items-center gap-2 py-1 text-sm text-slate-500 hover:underline"
    >
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${colours}`}>
        {change > 0 ? `${change} more` : change < 0 ? `${-change} fewer` : "No change"}
      </span>
      <span>
        than last {weekday}
        {change !== 0 && `, when it was ${lastWeek.quantity}`}
      </span>
    </Link>
  );
}

/**
 * The last seven days as bars, today's solid, each a link to that day's
 * dispatches. A day before the records begin has neither.
 */
function Strip({ days, startDate }: { days: DispatchedDay[]; startDate: string }) {
  const most = Math.max(...days.map((day) => day.quantity), 1);

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">Last 7 days</p>
      <ol className="flex gap-0.5">
        {days.map(({ date, quantity }, index) => {
          const isToday = index === days.length - 1;
          const day = `${formatWeekday(date)} ${formatDayAndMonth(date)}`;
          if (date < startDate) {
            return <NoRecordsDay key={date} date={date} label={`${day}: no records`} />;
          }
          const label = `${day}: ${counted(quantity, "cylinder")} dispatched`;
          return (
            <li key={date} className="min-w-0 flex-1">
              <Link
                href={billsOfDayHref("dispatch", date)}
                title={label}
                aria-label={label}
                className="group flex flex-col items-center rounded-md py-1 hover:bg-emerald-100/60"
              >
                <span
                  className={`text-xs tabular-nums ${isToday ? "font-semibold" : "text-slate-500"}`}
                >
                  {quantity}
                </span>
                <span className="mt-1 flex h-14 w-full items-end justify-center border-b border-slate-200">
                  {quantity > 0 && (
                    <span
                      // A day with any shows some bar, however busy the busiest.
                      style={{ height: `${Math.max((quantity / most) * 100, 6)}%` }}
                      className={`w-full max-w-6 rounded-t ${
                        isToday ? "bg-emerald-600" : "bg-emerald-200 group-hover:bg-emerald-300"
                      }`}
                    />
                  )}
                </span>
                <span className={`mt-1 text-xs ${isToday ? "font-semibold" : "text-slate-500"}`}>
                  {formatShortWeekday(date)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A day of the strip with no records, in line with the others. */
function NoRecordsDay({ date, label }: { date: string; label: string }) {
  return (
    <li title={label} className="flex min-w-0 flex-1 flex-col items-center py-1 text-slate-400">
      <span aria-hidden="true" className="text-xs">
        –
      </span>
      <span className="mt-1 h-14 w-full border-b border-slate-200" />
      <span aria-hidden="true" className="mt-1 text-xs">
        {formatShortWeekday(date)}
      </span>
      <span className="sr-only">{label}</span>
    </li>
  );
}

/** This month so far, against last month up to the same day. */
function MonthToDate({
  thisMonth,
  lastMonth,
  startDate,
}: Pick<Dashboard["dispatched"], "thisMonth" | "lastMonth"> & { startDate: string }) {
  // How far this month has come towards what last month had reached.
  const share =
    lastMonth.quantity > 0 ? Math.min(thisMonth.quantity / lastMonth.quantity, 1) : null;
  const href = ({ from, to }: { from: string; to: string }) =>
    postedBillsHref({ type: "dispatch", from, to });

  return (
    <div className="space-y-2 border-t border-emerald-100 pt-4 text-sm">
      <Link href={href(thisMonth)} className="flex justify-between gap-3 py-1 hover:underline">
        <span className="text-slate-600">Month to date</span>
        <span className="font-semibold tabular-nums">{thisMonth.quantity}</span>
      </Link>
      {share !== null && (
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-emerald-100">
          <div style={{ width: `${share * 100}%` }} className="h-full bg-emerald-600" />
        </div>
      )}
      {lastMonth.to < startDate ? (
        <p className="text-slate-500">No records for last month to compare with.</p>
      ) : (
        <Link
          href={href(lastMonth)}
          className="flex justify-between gap-3 py-1 text-slate-500 hover:underline"
        >
          <span>
            Last month to {formatDayAndMonth(lastMonth.to)}
            {startDate > lastMonth.from && `, with records from ${formatDate(startDate)}`}
          </span>
          <span className="tabular-nums">{lastMonth.quantity}</span>
        </Link>
      )}
    </div>
  );
}
