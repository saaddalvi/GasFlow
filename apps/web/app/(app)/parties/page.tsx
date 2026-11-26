import { auth } from "@clerk/nextjs/server";
import {
  PARTY_TYPES,
  partyListQuerySchema,
  type Party,
  type PartyList,
  type PartyListQuery,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { CheckboxField, Field, SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { Tag } from "@/components/tag";
import { fetchParties, orNull } from "@/lib/api";
import { partyListSearch } from "@/lib/party-list-search";
import { PARTY_TYPE_NAMES } from "@/lib/party-types";

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
  const list = await orNull(fetchParties(query));
  const queryString = partyListSearch(query);
  const narrowed = Boolean(query.search || query.type);

  return (
    <div className="space-y-6">
      <PageHeading title="Parties" subtitle="Customers, refillers and suppliers.">
        <Link href="/parties/new" className={buttonStyles.primary}>
          + Add party
        </Link>
      </PageHeading>
      {/* Starts afresh when the address changes, so that the boxes match it. */}
      <Filters key={queryString} query={query} />
      {list ? (
        <Results
          list={list}
          pageHref={(page) => `/parties?${partyListSearch({ ...query, page })}`}
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
    <Form action="/parties" className="rounded-xl border border-slate-200 bg-white p-5">
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
          <Link href="/parties" className="text-sm text-slate-500 hover:text-slate-700">
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
  list: PartyList;
  pageHref: (page: number) => string;
  /** What to say when nothing is listed. */
  emptyText: string;
}) {
  if (total === 0) {
    return <EmptyState>{emptyText}</EmptyState>;
  }
  if (parties.length === 0) {
    return (
      <EmptyState>
        There is nothing on this page.{" "}
        <Link href={pageHref(1)} className="text-brand-700 underline">
          Go to the first page
        </Link>
      </EmptyState>
    );
  }
  const first = (page - 1) * pageSize + 1;
  const last = first + parties.length - 1;

  return (
    <div className="space-y-3">
      {/* Relative, so that the hidden words in the table scroll with it. */}
      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Name
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Type
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                Abbreviation
              </th>
              <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">
                Mobile
              </th>
              <th scope="col" className="px-5 py-3">
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <p className="tabular-nums">
          {first} to {last} of {total}
        </p>
        <nav aria-label="Pages" className="flex gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className={buttonStyles.secondary}>
              Previous
            </Link>
          )}
          {last < total && (
            <Link href={pageHref(page + 1)} className={buttonStyles.secondary}>
              Next
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}

function Row({ party }: { party: Party }) {
  const href = `/parties/${party.id}`;

  return (
    <tr>
      <td className="px-5 py-3">
        <span className="flex flex-wrap items-center gap-2">
          <Link href={href} className="font-medium text-brand-700 wrap-anywhere hover:underline">
            {party.name}
          </Link>
          {!party.active && <Tag>Inactive</Tag>}
        </span>
      </td>
      <td className="px-3 py-3">{PARTY_TYPE_NAMES[party.type]}</td>
      <td className="hidden px-3 py-3 md:table-cell">{party.abbreviation}</td>
      <td className="hidden px-3 py-3 tabular-nums sm:table-cell">{party.mobile}</td>
      <td className="px-5 py-3 text-right">
        <Link href={`${href}/edit`} className="text-brand-700 hover:underline">
          Edit<span className="sr-only"> {party.name}</span>
        </Link>
      </td>
    </tr>
  );
}
