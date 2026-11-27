import { auth } from "@clerk/nextjs/server";
import {
  billListQuerySchema,
  billStatusSchema,
  billTypeSchema,
  PAPER_KIND_NAMES,
  PAPER_KINDS,
  BILL_TYPE_NAMES,
  type BillList,
  type BillListQuery,
  BILL_STATUS_NAMES,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BillTable } from "@/components/bill-table";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { CheckboxField, Field, SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { EmptyPage, Pagination } from "@/components/pagination";
import { fetchBills, orNull } from "@/lib/api";
import { billListSearch } from "@/lib/bill-list-search";
import { BILLS_PATH, NEW_BILL_PATH, OPENING_STOCK_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Bills · GasFlow",
};

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets the first page.
  // One party's bills are listed on its own page, as nothing here shows that choice.
  const asked = billListQuerySchema.omit({ partyId: true }).safeParse(await searchParams);
  const query = asked.data ?? billListQuerySchema.parse({});
  const list = await orNull(fetchBills(query));

  return (
    <div className="space-y-6">
      <PageHeading title="Bills" subtitle="The newest date first.">
        <div className="flex flex-wrap gap-2">
          <Link href={OPENING_STOCK_PATH} className={buttonStyles.secondary}>
            Opening stock
          </Link>
          <Link href={NEW_BILL_PATH} className={buttonStyles.primary}>
            + New bill
          </Link>
        </div>
      </PageHeading>
      {/* Starts afresh when the address changes, so that the box matches it. */}
      <Filters key={billListSearch(query)} query={query} />
      {list ? (
        <Results list={list} query={query} />
      ) : (
        <LoadError>
          The bills could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}

/** Narrows the list. What is chosen goes into the address. */
function Filters({ query }: { query: BillListQuery }) {
  return (
    <Form action={BILLS_PATH} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Bill number"
          name="number"
          type="search"
          defaultValue={query.number}
          hint="A refiller's slip number counts as one."
        />
        <Field
          label="Slip number"
          name="slipNumber"
          type="search"
          defaultValue={query.slipNumber}
          hint="Noted on a customer's return."
        />
        <Field label="Party name" name="party" type="search" defaultValue={query.party} />
        <SelectField label="Type" name="type" defaultValue={query.type ?? ""}>
          <option value="">All types</option>
          {billTypeSchema.options.map((type) => (
            <option key={type} value={type}>
              {BILL_TYPE_NAMES[type]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Paper kind" name="paperKind" defaultValue={query.paperKind ?? ""}>
          <option value="">All bills, on paper or not</option>
          {PAPER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PAPER_KIND_NAMES[kind]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" name="status" defaultValue={query.status ?? ""}>
          <option value="">Posted and cancelled</option>
          {billStatusSchema.options.map((status) => (
            <option key={status} value={status}>
              {BILL_STATUS_NAMES[status]}
            </option>
          ))}
        </SelectField>
        <DateFilter label="From date" name="from" defaultValue={query.from} />
        <DateFilter label="To date" name="to" defaultValue={query.to} />
        <DateFilter
          label="Entered on"
          name="enteredOn"
          defaultValue={query.enteredOn}
          hint="The day it was entered, whatever its date."
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <CheckboxField
          label="Only dispatches with cylinders pending"
          name="pending"
          value="true"
          defaultChecked={query.pending}
        />
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonStyles.secondary}>
            Search
          </button>
          <Link href={BILLS_PATH} className="text-sm text-slate-500 hover:text-slate-700">
            Reset
          </Link>
        </div>
      </div>
    </Form>
  );
}

/** One end of a range of dates. The bounds keep out a year that cannot be searched. */
function DateFilter(props: { label: string; name: string; defaultValue?: string; hint?: string }) {
  return <Field {...props} type="date" min="0001-01-01" max="9999-12-31" />;
}

function Results({
  list: { bills, total, page, pageSize },
  query,
}: {
  list: BillList;
  query: BillListQuery;
}) {
  const pageHref = (to: number) => `${BILLS_PATH}?${billListSearch({ ...query, page: to })}`;
  if (total === 0) {
    const narrowed = billListSearch({ ...query, page: 1 }) !== "";
    return (
      <EmptyState>{narrowed ? "No bills match." : "No bills have been entered yet."}</EmptyState>
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
