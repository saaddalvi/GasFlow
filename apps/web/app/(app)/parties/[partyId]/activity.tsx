import type { BillList, DailySummary, MovementDay } from "@gasflow/shared";
import Form from "next/form";
import Link from "next/link";
import { BillTable } from "@/components/bill-table";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { Field, SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { EmptyPage, Pagination } from "@/components/pagination";
import { formatDate } from "@/lib/dates";
import {
  BILL_CHOICES,
  partyPageHref,
  type BillChoice,
  type PartyPageQuery,
} from "@/lib/party-page-search";
import { partyPath } from "@/lib/routes";

/** The bills or the days that were asked for, or neither if they could not be loaded. */
export type Shown = { bills: BillList | null } | { days: DailySummary | null };

const BILL_CHOICE_NAMES: Record<BillChoice, string> = {
  active: "Active",
  cancelled: "Cancelled",
  all: "All",
};

const VIEW_NAMES: Record<PartyPageQuery["view"], string> = {
  bills: "Bills",
  daily: "Daily summary",
};

/** The party's bills and, if cylinders are sent to it, what moved day by day. */
export function Activity({
  partyId,
  query,
  shown,
  views,
}: {
  partyId: string;
  query: PartyPageQuery;
  shown: Shown;
  /** Which of the two this party has. */
  views: PartyPageQuery["view"][];
}) {
  const at = (changes: Partial<PartyPageQuery>) =>
    partyPageHref(partyId, { ...query, page: 1, ...changes }, "activity");

  return (
    <section id="activity" aria-labelledby="activity-heading" className="scroll-mt-20 space-y-3">
      <h2 id="activity-heading" className="sr-only">
        {views.map((view) => VIEW_NAMES[view]).join(" and ")}
      </h2>
      {views.length > 1 ? (
        <nav aria-label="History" className="flex gap-1 border-b border-slate-200">
          {views.map((view) => (
            <Link
              key={view}
              href={at({ view })}
              aria-current={view === query.view ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                view === query.view
                  ? "border-brand-500 font-medium text-brand-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {VIEW_NAMES[view]}
            </Link>
          ))}
        </nav>
      ) : (
        <p aria-hidden="true" className="text-lg font-semibold">
          {VIEW_NAMES[query.view]}
        </p>
      )}
      {/* Starts afresh when the address changes, so that the boxes match it. */}
      <Filters
        key={at({})}
        partyId={partyId}
        query={query}
        resetHref={at({ bills: "active", from: undefined, to: undefined })}
      />
      {"days" in shown ? (
        <Days days={shown.days} query={query} pageHref={(page) => at({ page })} />
      ) : (
        <Bills bills={shown.bills} query={query} pageHref={(page) => at({ page })} />
      )}
    </section>
  );
}

/** The range of dates and, for bills, which of them. What is chosen goes into the address. */
function Filters({
  partyId,
  query: { view, bills, from, to },
  resetHref,
}: {
  partyId: string;
  query: PartyPageQuery;
  resetHref: string;
}) {
  return (
    <Form
      action={`${partyPath(partyId)}#activity`}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      {/* Stays on the tab, and on the choice of bills while the other tab is open. */}
      {view === "daily" && <input type="hidden" name="view" value={view} />}
      {view === "daily" && <input type="hidden" name="bills" value={bills} />}
      <div className="flex flex-wrap items-end gap-4">
        <Field
          label="From date"
          name="from"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          defaultValue={from}
        />
        <Field
          label="To date"
          name="to"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          defaultValue={to}
        />
        {view === "bills" && (
          <SelectField label="Show" name="bills" defaultValue={bills}>
            {BILL_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {BILL_CHOICE_NAMES[choice]}
              </option>
            ))}
          </SelectField>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonStyles.secondary}>
            Apply
          </button>
          <Link href={resetHref} className="text-sm text-slate-500 hover:text-slate-700">
            Reset
          </Link>
        </div>
      </div>
    </Form>
  );
}

function Bills({
  bills: list,
  query: { bills: choice, from, to },
  pageHref,
}: {
  bills: BillList | null;
  query: PartyPageQuery;
  pageHref: (page: number) => string;
}) {
  if (!list) {
    return (
      <LoadError>
        The bills could not be loaded. Check that the API is running, then reload the page.
      </LoadError>
    );
  }
  const { bills, total, page, pageSize } = list;
  if (total === 0) {
    const which = choice === "all" ? "" : `${BILL_CHOICE_NAMES[choice].toLowerCase()} `;
    return (
      <EmptyState>
        There are no {which}bills{from || to ? " between those dates" : ""}.
      </EmptyState>
    );
  }
  if (bills.length === 0) {
    return <EmptyPage firstPageHref={pageHref(1)} />;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 tabular-nums">
        {total === 1 ? "1 bill" : `${total} bills`}
      </p>
      <BillTable bills={bills} />
      <Pagination
        page={page}
        pageSize={pageSize}
        shown={bills.length}
        total={total}
        pageHref={pageHref}
      />
    </div>
  );
}

function Days({
  days: list,
  query: { from, to },
  pageHref,
}: {
  days: DailySummary | null;
  query: PartyPageQuery;
  pageHref: (page: number) => string;
}) {
  if (!list) {
    return (
      <LoadError>
        The daily summary could not be loaded. Check that the API is running, then reload the page.
      </LoadError>
    );
  }
  const { days, total, page, pageSize } = list;
  if (total === 0) {
    return (
      <EmptyState>
        Nothing was sent or returned{from || to ? " between those dates" : " yet"}.
      </EmptyState>
    );
  }
  if (days.length === 0) {
    return <EmptyPage firstPageHref={pageHref(1)} />;
  }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="py-3 pl-4 pr-2 font-semibold sm:pl-5">
                Date
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                By gas
              </th>
              {["Sent", "Returned", "Net out"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-2 py-3 text-right font-semibold last:pr-4 sm:px-3 sm:last:pr-5"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {days.map((day) => (
              <Day key={day.date} day={day} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        shown={days.length}
        total={total}
        pageHref={pageHref}
      />
    </div>
  );
}

const COUNT_CELL = "px-2 py-3 text-right tabular-nums last:pr-4 sm:px-3 sm:last:pr-5";

/** One day. On a narrow screen, its gases sit under its date. */
function Day({ day: { date, sent, returned, netOut, gases } }: { day: MovementDay }) {
  return (
    <tr className="align-top">
      <th scope="row" className="py-3 pl-4 pr-2 font-medium sm:pl-5">
        {formatDate(date)}
        <span className="mt-1 block font-normal text-slate-500 md:hidden">
          <Gases gases={gases} />
        </span>
      </th>
      <td className="hidden px-3 py-3 text-slate-500 md:table-cell">
        <Gases gases={gases} />
      </td>
      <td className={COUNT_CELL}>{sent}</td>
      <td className={COUNT_CELL}>{returned}</td>
      <td className={`${COUNT_CELL} font-semibold`}>{netOut}</td>
    </tr>
  );
}

/** What moved of each gas, a line for each, such as "Argon: 3 sent, 1 returned". */
function Gases({ gases }: { gases: MovementDay["gases"] }) {
  return gases.map(({ gas, sent, returned }) => (
    <span key={gas.id} className="block wrap-anywhere">
      {gas.name}:{" "}
      {[sent && `${sent} sent`, returned && `${returned} returned`].filter(Boolean).join(", ")}
    </span>
  ));
}
