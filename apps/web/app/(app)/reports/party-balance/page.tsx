import { auth } from "@clerk/nextjs/server";
import {
  balanceRegisterQuerySchema,
  isBelowZero,
  REGISTER_PARTY_TYPES,
  type BalanceRegister,
  type BalanceRegisterQuery,
  type RegisterParty,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { CylinderCount } from "@/components/cylinder-count";
import { EmptyState } from "@/components/empty-state";
import { Field, SelectField } from "@/components/fields";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { EmptyPage, Pagination } from "@/components/pagination";
import { NoRecords } from "@/components/report-day";
import { Tag } from "@/components/tag";
import { fetchBalanceRegister, orNull } from "@/lib/api";
import { balanceRegisterSearch } from "@/lib/balance-register-search";
import { formatDate } from "@/lib/dates";
import { PARTY_TYPE_NAMES } from "@/lib/party-types";
import { BALANCE_REGISTER_PATH, partyPath } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Balance register · GasFlow",
};

/** How many gases a row names before it is opened. */
const GASES_IN_BRIEF = 2;

export default async function BalanceRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets today's register.
  const asked = balanceRegisterQuerySchema.safeParse(await searchParams);
  const query = asked.data ?? balanceRegisterQuerySchema.parse({});
  const register = await orNull(fetchBalanceRegister(query));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Balance register"
        subtitle={
          register
            ? `What customers and refillers held at the end of ${formatDate(register.date)}.`
            : "What customers and refillers held."
        }
      />
      {/* Starts afresh when the address changes, so that the boxes match it. */}
      <Filters
        key={balanceRegisterSearch(query)}
        query={{ ...query, date: register?.date ?? query.date }}
      />
      {register ? (
        <Results
          register={register}
          pageHref={(page) =>
            `${BALANCE_REGISTER_PATH}?${balanceRegisterSearch({ ...query, page })}`
          }
          narrowed={Boolean(query.search || query.type)}
          all={query.show === "all"}
        />
      ) : (
        <LoadError>
          The balance register could not be loaded. Check that the API is running, then reload the
          page.
        </LoadError>
      )}
    </div>
  );
}

/** Chooses the day and narrows the list. What is chosen goes into the address. */
function Filters({ query }: { query: BalanceRegisterQuery }) {
  return (
    <Form
      action={BALANCE_REGISTER_PATH}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
        <Field label="Date" name="date" type="date" defaultValue={query.date} required />
        <SelectField label="Type" name="type" defaultValue={query.type ?? ""}>
          <option value="">Customers and refillers</option>
          {REGISTER_PARTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PARTY_TYPE_NAMES[type]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Show" name="show" defaultValue={query.show}>
          <option value="non_zero">Non-zero holdings</option>
          <option value="all">All parties</option>
        </SelectField>
        <Field label="Name" name="search" type="search" defaultValue={query.search} />
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonStyles.secondary}>
            Apply
          </button>
          <Link
            href={BALANCE_REGISTER_PATH}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Reset
          </Link>
        </div>
      </div>
    </Form>
  );
}

function Results({
  register: { date, startDate, parties, summary, total, page, pageSize },
  pageHref,
  narrowed,
  all,
}: {
  register: BalanceRegister;
  pageHref: (page: number) => string;
  /** Whether a type or name was asked for. */
  narrowed: boolean;
  /** Whether parties holding nothing were asked for too. */
  all: boolean;
}) {
  if (!startDate || date < startDate) {
    return <NoRecords startDate={startDate} />;
  }
  if (total === 0) {
    return <EmptyState>{nothingListed(narrowed, all)}</EmptyState>;
  }
  return (
    <div className="space-y-3">
      <Header summary={summary} total={total} />
      {parties.length === 0 ? (
        <EmptyPage firstPageHref={pageHref(1)} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">
                    Party
                  </th>
                  <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
                    Type
                  </th>
                  <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">
                    By gas
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-5">
                    Total held
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
        </>
      )}
    </div>
  );
}

/** Why no party is listed. */
function nothingListed(narrowed: boolean, all: boolean): string {
  if (all) {
    return narrowed ? "No parties match." : "There are no customers or refillers yet.";
  }
  // A party that matches may be left out for holding nothing.
  return narrowed
    ? "No party that matches held any cylinders."
    : "No customer or refiller held any cylinders.";
}

/** The figures for every party listed, on every page together. */
function Header({
  summary: { held, belowZero },
  total,
}: {
  summary: BalanceRegister["summary"];
  total: number;
}) {
  return (
    <p className="text-sm text-slate-600 tabular-nums">
      {total} {total === 1 ? "party" : "parties"}, holding <CylinderCount count={held} />,{" "}
      <span className={belowZero > 0 ? "font-medium text-rose-700" : undefined}>
        {belowZero} below zero
      </span>
    </p>
  );
}

/** One party. On a narrow screen, what has no column of its own sits under its name. */
function Row({ party }: { party: RegisterParty }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3 sm:px-5">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={partyPath(party.id)}
            className="font-medium text-brand-700 wrap-anywhere hover:underline"
          >
            {party.name}
          </Link>
          {isBelowZero(party) && <Tag colour="rose">Below zero</Tag>}
          {!party.active && <Tag>Inactive</Tag>}
        </span>
        <span className="block text-slate-500 md:hidden">{PARTY_TYPE_NAMES[party.type]}</span>
        <div className="mt-1 sm:hidden">
          <Breakdown gases={party.gases} />
        </div>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">{PARTY_TYPE_NAMES[party.type]}</td>
      <td className="hidden px-3 py-3 sm:table-cell">
        <Breakdown gases={party.gases} />
      </td>
      <td className="px-4 py-3 text-right font-semibold sm:px-5">
        <CylinderCount count={party.total} />
      </td>
    </tr>
  );
}

/** What the party held of each gas: in brief, until opened to show every gas. */
function Breakdown({ gases }: { gases: RegisterParty["gases"] }) {
  if (gases.length === 0) {
    return <span className="text-slate-400">Nothing held</span>;
  }
  const more = gases.length - GASES_IN_BRIEF;
  return (
    <details className="group">
      <summary className="cursor-pointer text-slate-500 wrap-anywhere">
        <span className="group-open:hidden">
          {gases.slice(0, GASES_IN_BRIEF).map(({ gas, quantity }, index) => (
            <span key={gas.id}>
              {index > 0 && ", "}
              {gas.name} <CylinderCount count={quantity} />
            </span>
          ))}
          {more > 0 && ` and ${more} more`}
        </span>
        <span className="hidden group-open:inline">Every gas</span>
      </summary>
      <ul className="mt-2 max-w-xs divide-y divide-slate-100">
        {gases.map(({ gas, quantity }) => (
          <li key={gas.id} className="flex justify-between gap-4 py-1">
            <span className="wrap-anywhere">{gas.name}</span>
            <CylinderCount count={quantity} />
          </li>
        ))}
      </ul>
    </details>
  );
}
