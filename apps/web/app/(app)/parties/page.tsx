import { auth } from "@clerk/nextjs/server";
import {
  billName,
  PARTY_TYPES,
  partyListQuerySchema,
  BILL_TYPE_NAMES,
  PARTY_TYPE_NAMES,
  type PartyListQuery,
  type PartyReport,
  type ReportedParty,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { CylinderCount } from "@/components/cylinder-count";
import { EmptyState } from "@/components/empty-state";
import { CheckboxField, Field, SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { EmptyPage, Pagination } from "@/components/pagination";
import { Tag } from "@/components/tag";
import { fetchPartyReport, orNull } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { partyListSearch } from "@/lib/party-list-search";
import { billPath, partyPath, PARTIES_PATH } from "@/lib/routes";
import { Summary } from "./summary";

export const metadata: Metadata = {
  title: "Parties · GasFlow",
};

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets the whole list.
  const asked = partyListQuerySchema.safeParse(await searchParams);
  const query = asked.data ?? partyListQuerySchema.parse({});
  const list = await orNull(fetchPartyReport(query));
  const queryString = partyListSearch(query);
  const narrowed = Boolean(query.search || query.type);

  return (
    <div className="space-y-6">
      <PageHeading title="Parties" subtitle="Customers, refillers and suppliers.">
        <Link href={`${PARTIES_PATH}/new`} className={buttonStyles.primary}>
          + Add party
        </Link>
      </PageHeading>
      {list && <Summary summary={list.summary} />}
      {/* Starts afresh when the address changes, so that the boxes match it. */}
      <Filters key={queryString} query={query} />
      {list ? (
        <Results
          list={list}
          pageHref={(page) => `${PARTIES_PATH}?${partyListSearch({ ...query, page })}`}
          emptyText={
            narrowed
              ? "No parties match."
              : query.inactive
                ? "There are no parties yet."
                : "There are no active parties."
          }
        />
      ) : (
        <LoadError>
          The parties could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}

/** Narrows the list. What is chosen goes into the address. */
function Filters({ query }: { query: PartyListQuery }) {
  return (
    <Form action={PARTIES_PATH} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="grid items-end gap-4 md:grid-cols-[2fr_1fr_auto_auto]">
        <Field label="Name" name="search" type="search" defaultValue={query.search} />
        <SelectField label="Type" name="type" defaultValue={query.type ?? ""}>
          <option value="">All types</option>
          {PARTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PARTY_TYPE_NAMES[type]}
            </option>
          ))}
        </SelectField>
        <div className="md:pb-1">
          <CheckboxField
            label="Show inactive"
            name="inactive"
            value="true"
            defaultChecked={query.inactive}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonStyles.secondary}>
            Search
          </button>
          <Link href={PARTIES_PATH} className="text-sm text-slate-500 hover:text-slate-700">
            Reset
          </Link>
        </div>
      </div>
    </Form>
  );
}

function Results({
  list: { parties, total, page, pageSize },
  pageHref,
  emptyText,
}: {
  list: PartyReport;
  pageHref: (page: number) => string;
  /** What to say when nothing is listed. */
  emptyText: string;
}) {
  if (total === 0) {
    return <EmptyState>{emptyText}</EmptyState>;
  }
  if (parties.length === 0) {
    return <EmptyPage firstPageHref={pageHref(1)} />;
  }
  return (
    <div className="space-y-3">
      {/* Relative, so that the hidden words in the table scroll with it. */}
      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold sm:px-5">
                Name
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                Type
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Holding now
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">
                Last bill
              </th>
              <th scope="col" className="px-4 py-3 sm:px-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parties.map((party) => (
              <Row key={party.id} party={party} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        shown={parties.length}
        total={total}
        pageHref={pageHref}
      />
    </div>
  );
}

/** One party. On a narrow screen, what has no column of its own sits under its name. */
function Row({ party }: { party: ReportedParty }) {
  const href = partyPath(party.id);

  return (
    <tr className="align-top">
      <td className="px-4 py-3 sm:px-5">
        <span className="flex flex-wrap items-center gap-2">
          <Link href={href} className="font-medium text-brand-700 wrap-anywhere hover:underline">
            {party.name}
          </Link>
          {!party.active && <Tag>Inactive</Tag>}
        </span>
        <span className="block text-slate-500 md:hidden">{PARTY_TYPE_NAMES[party.type]}</span>
        {party.mobile && <span className="block tabular-nums text-slate-500">{party.mobile}</span>}
        {party.lastBill && (
          <span className="mt-1 block text-slate-500 sm:hidden">
            Last bill <LastBill bill={party.lastBill} />
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3 md:table-cell">{PARTY_TYPE_NAMES[party.type]}</td>
      <td className="px-3 py-3">
        <Holding holding={party.holding} />
      </td>
      <td className="hidden px-3 py-3 sm:table-cell">
        {party.lastBill ? (
          <LastBill bill={party.lastBill} />
        ) : (
          <span className="text-slate-400">None</span>
        )}
      </td>
      <td className="px-4 py-3 text-right sm:px-5">
        <Link href={`${href}/edit`} className="text-brand-700 hover:underline">
          Edit<span className="sr-only"> {party.name}</span>
        </Link>
      </td>
    </tr>
  );
}

/** What the party holds: all together, and then gas by gas. */
function Holding({ holding }: { holding: ReportedParty["holding"] }) {
  if (!holding) {
    return <span className="text-slate-400">Not counted</span>;
  }
  const { gases, total } = holding;
  return (
    <>
      <span className="font-semibold">
        <CylinderCount count={total} />
      </span>
      {gases.map(({ gas, quantity }) => (
        <span key={gas.id} className="block text-slate-500 wrap-anywhere lg:whitespace-nowrap">
          {gas.name} <CylinderCount count={quantity} />
        </span>
      ))}
    </>
  );
}

function LastBill({ bill }: { bill: NonNullable<ReportedParty["lastBill"]> }) {
  return (
    <>
      <Link
        href={billPath(bill.id)}
        className="text-brand-700 tabular-nums wrap-anywhere hover:underline"
      >
        {billName(bill)}
      </Link>
      <span className="block text-slate-500">
        {BILL_TYPE_NAMES[bill.type]} ·{" "}
        <span className="whitespace-nowrap">{formatDate(bill.date)}</span>
      </span>
    </>
  );
}
