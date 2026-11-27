import { auth } from "@clerk/nextjs/server";
import { stockReportQuerySchema, type StockReport, type StockReportRow } from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { NoRecords, ReportDayPicker, reportDayHref } from "@/components/report-day";
import { CountCell, ReportTable, ROW_HEADING_CELL } from "@/components/report-table";
import { fetchStockReport, fetchToday, orNull } from "@/lib/api";
import { formatDate, monthEnds } from "@/lib/dates";
import { STOCK_REPORT_PATH } from "@/lib/routes";

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

/** Chooses the day: by date, one day at a time, or by shortcut. */
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
    <ReportDayPicker path={STOCK_REPORT_PATH} date={date}>
      <nav aria-label="Shortcuts" className="flex flex-wrap gap-2">
        {shortcuts.map(({ label, to }) => (
          <Link
            key={label}
            href={reportDayHref(STOCK_REPORT_PATH, to)}
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
    </ReportDayPicker>
  );
}

function Figures({ report: { startDate, rows } }: { report: StockReport }) {
  if (rows.length === 0) {
    return <NoRecords startDate={startDate} />;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 sm:hidden">
        Scroll the table sideways to see every column.
      </p>
      <ReportTable>
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th
              scope="col"
              rowSpan={2}
              className={`${ROW_HEADING_CELL} align-bottom font-semibold`}
            >
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
      </ReportTable>
    </div>
  );
}

function Row({ row: { gas, shop, customers, refillers, total } }: { row: StockReportRow }) {
  return (
    <tr>
      <th scope="row" className={`${ROW_HEADING_CELL} font-medium`}>
        {gas.name}
      </th>
      <CountCell count={shop.filled} startsGroup />
      <CountCell count={shop.empty} />
      <CountCell count={shop.defective} />
      <CountCell count={customers} startsGroup />
      <CountCell count={refillers} startsGroup />
      <CountCell count={total} startsGroup bold />
    </tr>
  );
}
