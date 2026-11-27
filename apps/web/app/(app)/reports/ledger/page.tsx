import { auth } from "@clerk/nextjs/server";
import {
  dayLedgerQuerySchema,
  type DayLedger,
  type DayLedgerTable,
  FILL_STATE_NAMES,
} from "@gasflow/shared";
import type { Metadata } from "next";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { NoRecords, ReportDayPicker } from "@/components/report-day";
import { CountCell, ReportTable, ROW_HEADING_CELL } from "@/components/report-table";
import { fetchDayLedger, orNull } from "@/lib/api";
import { formatDateInFull } from "@/lib/dates";
import { DAY_LEDGER_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Day ledger · GasFlow",
};

const ROWS = [
  { count: "opening", label: "Opening" },
  { count: "in", label: "In" },
  { count: "out", label: "Out" },
  { count: "closing", label: "Closing" },
] as const;

export default async function DayLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets today.
  const asked = dayLedgerQuerySchema.safeParse(await searchParams);
  const ledger = await orNull(fetchDayLedger(asked.data ?? {}));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Day ledger"
        subtitle={
          ledger
            ? `The shop's cylinders on ${formatDateInFull(ledger.date)}.`
            : "The shop's cylinders over a day."
        }
      />
      {ledger ? (
        <>
          <ReportDayPicker path={DAY_LEDGER_PATH} date={ledger.date} />
          <Tables ledger={ledger} />
        </>
      ) : (
        <LoadError>
          The day ledger could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}

function Tables({ ledger: { startDate, tables } }: { ledger: DayLedger }) {
  if (tables.length === 0) {
    return <NoRecords startDate={startDate} />;
  }
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500 lg:hidden">
        Scroll a table sideways to see every column.
      </p>
      {tables.map((table) => (
        <FillStateTable key={table.fillState} table={table} />
      ))}
    </div>
  );
}

/** The shop's day in one fill state: a column for each gas, and one for them all. */
function FillStateTable({ table: { fillState, gases, total } }: { table: DayLedgerTable }) {
  const headingId = `${fillState}-heading`;
  return (
    <section>
      <h2
        id={headingId}
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        {FILL_STATE_NAMES[fillState]}
      </h2>
      <ReportTable labelledBy={headingId}>
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <td className={ROW_HEADING_CELL} />
            {gases.map(({ gas }) => (
              <th key={gas.id} scope="col" className="px-3 py-3 align-bottom font-semibold">
                {gas.name}
              </th>
            ))}
            <th
              scope="col"
              className="border-l border-slate-100 px-3 py-3 align-bottom font-semibold"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map(({ count, label }) => {
            const bold = count === "closing";
            return (
              <tr key={count}>
                <th
                  scope="row"
                  className={`${ROW_HEADING_CELL} ${bold ? "font-semibold" : "font-medium"}`}
                >
                  {label}
                </th>
                {gases.map((column) => (
                  <CountCell key={column.gas.id} count={column[count]} bold={bold} />
                ))}
                <CountCell count={total[count]} startsGroup bold />
              </tr>
            );
          })}
        </tbody>
      </ReportTable>
    </section>
  );
}
