import { auth } from "@clerk/nextjs/server";
import { stockReportQuerySchema, type StockReport, type StockReportRow } from "@gasflow/shared";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { fetchStockReport, fetchToday, orNull } from "@/lib/api";
import { addDays, formatDate, monthEnds } from "@/lib/dates";
import { OPENING_STOCK_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Stock · GasFlow",
};

const MONTH_END_SHORTCUTS = 6;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets today.
  const asked = stockReportQuerySchema.safeParse(await searchParams);
  const [report, today] = await Promise.all([
    orNull(fetchStockReport(asked.data ?? {})),
    orNull(fetchToday()),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Stock"
        subtitle={
          report
            ? `Where the cylinders were at the end of ${formatDate(report.date)}.`
            : "Where the cylinders are."
        }
      />
      {report && today ? (
        <>
          <DatePicker report={report} today={today} />
          <Figures report={report} />
        </>
      ) : (
        <LoadError>
          The stock report could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}

const dateHref = (date: string) => `/reports/stock?date=${date}`;

/** Chooses the day: by date, by shortcut, or one day at a time. */
function DatePicker({
  report: { date, startDate },
  today,
}: {
  report: StockReport;
  today: string;
}) {
  const shortcuts = [
    { label: "Today", to: today },
    ...(startDate ? monthEnds(startDate, today, MONTH_END_SHORTCUTS) : []).map((end) => ({
      label: formatDate(end),
      to: end,
    })),
  ];

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Starts afresh when the date changes, so that the box matches it. */}
        <Form key={date} action="/reports/stock" className="flex items-end gap-3">
          <Field label="Date" name="date" type="date" defaultValue={date} required />
          <button type="submit" className={buttonStyles.secondary}>
            Apply
          </button>
        </Form>
        <nav aria-label="Days" className="flex gap-2">
          <Link href={dateHref(addDays(date, -1))} className={buttonStyles.secondary}>
            Previous day
          </Link>
          <Link href={dateHref(addDays(date, 1))} className={buttonStyles.secondary}>
            Next day
          </Link>
        </nav>
      </div>
      <nav aria-label="Shortcuts" className="flex flex-wrap gap-2">
        {shortcuts.map(({ label, to }) => (
          <Link
            key={label}
            href={dateHref(to)}
            aria-current={to === date ? "date" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${
              to === date
                ? "border-brand-200 bg-brand-50 font-medium text-brand-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Figures({ report: { startDate, rows } }: { report: StockReport }) {
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
  if (rows.length === 0) {
    return <EmptyState>The records begin on {formatDate(startDate)}.</EmptyState>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 sm:hidden">
        Scroll the table sideways to see every column.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" rowSpan={2} className={`${GAS_CELL} align-bottom font-semibold`}>
                Gas
              </th>
              <th
                scope="colgroup"
                colSpan={3}
                className="border-b border-l border-slate-100 px-3 pt-3 pb-1 text-center font-semibold"
              >
                Shop
              </th>
              {["With customers", "At refiller", "Total"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  rowSpan={2}
                  className="border-l border-slate-100 px-3 py-3 align-bottom font-semibold"
                >
                  {heading}
                </th>
              ))}
            </tr>
            <tr>
              {["Filled", "Empty", "Defective"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-3 pt-1 pb-3 font-semibold first:border-l first:border-slate-100"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <Row key={row.gas.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stays in view while the figures are scrolled sideways on a narrow screen.
const GAS_CELL = "sticky left-0 bg-white px-5 py-3 text-left";

function Row({ row: { gas, shop, customers, refillers, total } }: { row: StockReportRow }) {
  return (
    <tr>
      <th scope="row" className={`${GAS_CELL} font-medium`}>
        {gas.name}
      </th>
      <Count count={shop.filled} startsGroup />
      <Count count={shop.empty} />
      <Count count={shop.defective} />
      <Count count={customers} startsGroup />
      <Count count={refillers} startsGroup />
      <Count count={total} startsGroup bold />
    </tr>
  );
}

/** One figure. A negative count means that bills are missing or wrong, so it stands out. */
function Count({
  count,
  startsGroup,
  bold,
}: {
  count: number;
  startsGroup?: boolean;
  bold?: boolean;
}) {
  const colours = count < 0 ? "bg-rose-100 text-rose-700" : count === 0 ? "text-slate-400" : "";
  return (
    <td
      className={`px-3 py-3 ${startsGroup ? "border-l border-slate-100" : ""} ${
        bold ? "font-semibold" : ""
      } ${colours}`}
    >
      {count}
    </td>
  );
}
