import { auth } from "@clerk/nextjs/server";
import {
  pendingBillName,
  pendingReturnListQuerySchema,
  type PendingReturn,
  type PendingReturnList,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { EmptyPage, Pagination } from "@/components/pagination";
import { PendingItem } from "@/components/pending-item";
import { fetchMe, fetchOverdueLimit, fetchPendingReturns, orNull } from "@/lib/api";
import {
  partyPath,
  PENDING_RETURNS_PATH,
  RECEIVE_EMPTIES_PATH,
  receiveEmptiesFromPath,
} from "@/lib/routes";
import { OverdueLimitDialog } from "./overdue-limit-dialog";

export const metadata: Metadata = {
  title: "Pending returns · GasFlow",
};

export default async function PendingReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets the first page.
  // Every customer's, whatever else it asks for.
  const asked = pendingReturnListQuerySchema.pick({ page: true }).safeParse(await searchParams);
  const [list, limit, me] = await Promise.all([
    orNull(fetchPendingReturns(asked.data ?? pendingReturnListQuerySchema.parse({}))),
    orNull(fetchOverdueLimit()),
    orNull(fetchMe()),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Pending returns"
        subtitle="Cylinders customers have yet to return, the longest out first."
      >
        <Link href={RECEIVE_EMPTIES_PATH} className={buttonStyles.secondary}>
          Receive empties
        </Link>
      </PageHeading>
      {/* Only an admin changes the limit. The API refuses everyone else whatever
          is shown here. */}
      {limit && <Limit days={limit.days} isAdmin={me?.isAdmin ?? false} />}
      {list ? (
        <Rows list={list} />
      ) : (
        <LoadError>
          The pending returns could not be loaded. Check that the API is running, then reload the
          page.
        </LoadError>
      )}
    </div>
  );
}

/** What counts as overdue. */
function Limit({ days, isAdmin }: { days: number; isAdmin: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">
      <p>
        Cylinders are overdue after more than{" "}
        <span className="font-semibold tabular-nums">{days === 1 ? "1 day" : `${days} days`}</span>{" "}
        out.
      </p>
      {isAdmin && <OverdueLimitDialog days={days} />}
    </div>
  );
}

const pageHref = (page: number) => `${PENDING_RETURNS_PATH}?page=${page}`;

function Rows({ list: { rows, total, page, pageSize } }: { list: PendingReturnList }) {
  if (total === 0) {
    return <EmptyState>No customer has cylinders pending.</EmptyState>;
  }
  if (rows.length === 0) {
    return <EmptyPage firstPageHref={pageHref(1)} />;
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
        {rows.map((row) => (
          <Row key={`${row.bill.id} ${row.gas.id}`} row={row} />
        ))}
      </ul>
      <Pagination
        page={page}
        pageSize={pageSize}
        shown={rows.length}
        total={total}
        pageHref={pageHref}
      />
    </div>
  );
}

/** One customer's cylinders of a gas still out on one bill. */
function Row({ row }: { row: PendingReturn }) {
  const { customer, bill, gas, pending } = row;

  return (
    <PendingItem
      row={row}
      count={`${pending} pending`}
      customer={
        <Link href={partyPath(customer.id)} className="font-medium hover:underline">
          {customer.name}
        </Link>
      }
      action={
        customer.active ? (
          <Link
            href={receiveEmptiesFromPath(customer.id)}
            className={`${buttonStyles.secondary} inline-block whitespace-nowrap`}
          >
            Receive empties
            <span className="sr-only">
              {" "}
              from {customer.name}, for {pendingBillName(bill)}, {gas.name}
            </span>
          </Link>
        ) : (
          // Nothing can be received from them until they are active again.
          <Link
            href={partyPath(customer.id)}
            className="text-slate-500 underline hover:text-slate-700"
          >
            Inactive customer
          </Link>
        )
      }
    />
  );
}
