import { auth } from "@clerk/nextjs/server";
import {
  billListQuerySchema,
  billStatusSchema,
  type BillList,
  type BillListQuery,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BillStatusTag } from "@/components/bill-status-tag";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { EmptyPage, Pagination } from "@/components/pagination";
import { fetchBills, orNull } from "@/lib/api";
import { BILL_STATUS_NAMES, describeBillType, quantitiesByGas } from "@/lib/bill-names";
import { billListSearch } from "@/lib/bill-list-search";
import { formatDate } from "@/lib/dates";
import { billPath, BILLS_PATH, NEW_BILL_PATH, OPENING_STOCK_PATH } from "@/lib/routes";

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
  const asked = billListQuerySchema.safeParse(await searchParams);
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
      <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,14rem)_auto] sm:justify-start">
        <SelectField label="Status" name="status" defaultValue={query.status ?? ""}>
          <option value="">All bills</option>
          {billStatusSchema.options.map((status) => (
            <option key={status} value={status}>
              {BILL_STATUS_NAMES[status]}
            </option>
          ))}
        </SelectField>
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonStyles.secondary}>
            Show
          </button>
          <Link href={BILLS_PATH} className="text-sm text-slate-500 hover:text-slate-700">
            Reset
          </Link>
        </div>
      </div>
    </Form>
  );
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
    return (
      <EmptyState>
        {query.status ? `No bills are ${query.status}.` : "No bills have been entered yet."}
      </EmptyState>
    );
  }
  if (bills.length === 0) {
    return <EmptyPage firstPageHref={pageHref(1)} />;
  }
  return (
    <div className="space-y-3">
      {/* Relative, so that the hidden words in the table scroll with it. */}
      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Number
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                Date
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                Type
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                From and to
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">
                Lines
              </th>
              <th scope="col" className="hidden px-5 py-3 font-semibold sm:table-cell">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bills.map((bill) => (
              <Row key={bill.id} bill={bill} />
            ))}
          </tbody>
        </table>
      </div>
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

/** One bill. On a narrow screen, what has no column of its own sits under another. */
function Row({ bill }: { bill: BillList["bills"][number] }) {
  const { id, number, date, from, to, lines, status } = bill;
  const quantities = quantitiesByGas(lines);

  return (
    <tr className="align-top">
      <td className="px-5 py-3">
        <Link
          href={billPath(id)}
          className="font-medium text-brand-700 tabular-nums wrap-anywhere hover:underline"
        >
          {number}
        </Link>
        <span className="block text-slate-500 md:hidden">{formatDate(date)}</span>
        <span className="block text-slate-500 md:hidden">{describeBillType(bill)}</span>
        <span className="mt-1 block sm:hidden">
          <BillStatusTag status={status} />
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 md:table-cell">{formatDate(date)}</td>
      <td className="hidden px-3 py-3 md:table-cell">{describeBillType(bill)}</td>
      <td className="px-3 py-3 wrap-anywhere">
        {from && <span className="block text-slate-500">{from.name} →</span>}
        {/* Only a write-off has nobody receiving. */}
        {to ? to.name : "Written off"}
        <span className="mt-1 block text-slate-500 lg:hidden">{quantities}</span>
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">{quantities}</td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <BillStatusTag status={status} />
      </td>
    </tr>
  );
}
