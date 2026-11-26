import { auth } from "@clerk/nextjs/server";
import { openingStockListQuerySchema, type OpeningStockList } from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { EmptyPage, Pagination } from "@/components/pagination";
import {
  fetchGases,
  fetchMe,
  fetchOpeningStock,
  fetchOpeningStockParties,
  fetchStartDate,
  orNull,
} from "@/lib/api";
import { formatDate, formatMoment } from "@/lib/dates";
import { BILL_PARTY_TYPE_NAMES } from "@/lib/party-types";
import { billPath, OPENING_STOCK_PATH } from "@/lib/routes";
import { OpeningStockForm } from "./opening-stock-form";
import { StartDateDialog } from "./start-date-dialog";

export const metadata: Metadata = {
  title: "Opening stock · GasFlow",
};

export default async function OpeningStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets the first page.
  const asked = openingStockListQuerySchema.safeParse(await searchParams);
  const query = asked.data ?? openingStockListQuerySchema.parse({});
  const [setup, me] = await Promise.all([orNull(fetchStartDate()), orNull(fetchMe())]);
  // Only admins set the date and enter stock. The API refuses everyone else
  // whatever is shown here.
  const isAdmin = me?.isAdmin ?? false;

  return (
    <div className="space-y-8">
      <PageHeading
        title="Opening stock"
        subtitle={
          setup?.startDate
            ? `What each party held on the start date, ${formatDate(setup.startDate)}.`
            : "What each party held on the start date."
        }
      />
      {!setup || !me ? (
        <LoadError>
          Opening stock could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      ) : !setup.startDate ? (
        <NoStartDate isAdmin={isAdmin} />
      ) : (
        <>
          {isAdmin && <EntryForm />}
          <Entries page={query.page} />
        </>
      )}
    </div>
  );
}

function NoStartDate({ isAdmin }: { isAdmin: boolean }) {
  return isAdmin ? (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">First, set the start date</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Opening stock is what each party held on that date.
      </p>
      <StartDateDialog />
    </section>
  ) : (
    <EmptyState>An admin has to set the start date before opening stock is entered.</EmptyState>
  );
}

/** The form for one party's opening stock. */
async function EntryForm() {
  const [offered, gases] = await Promise.all([
    orNull(fetchOpeningStockParties()),
    orNull(fetchGases()),
  ]);
  if (!offered || !gases) {
    return (
      <LoadError>
        The form could not be loaded. Check that the API is running, then reload the page.
      </LoadError>
    );
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Enter opening stock</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Do one for the shop, then one for each customer and refiller already holding cylinders. A
        party has only one.
      </p>
      <OpeningStockForm parties={offered.parties} gases={gases.gases} />
    </section>
  );
}

async function Entries({ page }: { page: number }) {
  const list = await orNull(fetchOpeningStock({ page }));
  if (!list) {
    return (
      <LoadError>
        The entries could not be loaded. Check that the API is running, then reload the page.
      </LoadError>
    );
  }
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Entered so far
      </h2>
      <Table list={list} />
    </section>
  );
}

function Table({ list: { entries, total, page, pageSize } }: { list: OpeningStockList }) {
  const pageHref = (to: number) => `${OPENING_STOCK_PATH}?page=${to}`;
  if (total === 0) {
    return <EmptyState>No opening stock has been entered yet.</EmptyState>;
  }
  if (entries.length === 0) {
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
                Party
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                Number
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Cylinders
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">
                Entered
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-5 py-3">
                  <span className="font-medium wrap-anywhere">{entry.party.name}</span>
                  <span className="block text-slate-500">
                    {BILL_PARTY_TYPE_NAMES[entry.party.type]}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 tabular-nums md:table-cell">
                  {entry.number}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{entry.quantity}</td>
                <td className="hidden px-3 py-3 sm:table-cell">
                  {entry.enteredBy.displayName}
                  <span className="block text-slate-500">{formatMoment(entry.enteredAt)}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link href={billPath(entry.id)} className="text-brand-700 hover:underline">
                    View<span className="sr-only"> {entry.party.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        shown={entries.length}
        total={total}
        pageHref={pageHref}
      />
    </div>
  );
}
