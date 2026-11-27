import { auth } from "@clerk/nextjs/server";
import {
  billListQuerySchema,
  holdsCylinders,
  PARTY_TYPE_NAMES,
  type BillStatus,
  type Party,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionDialog } from "@/components/action-dialog";
import { buttonStyles } from "@/components/button-styles";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { Tag } from "@/components/tag";
import {
  fetchBills,
  fetchDailySummary,
  fetchPartyHolding,
  fetchPendingReturns,
  fetchUnmatched,
  orNull,
} from "@/lib/api";
import {
  partyPageHref,
  readPartyPageQuery,
  type BillChoice,
  type PartyPageQuery,
} from "@/lib/party-page-search";
import { partyPath, receiveEmptiesFromPath, stockCardPath } from "@/lib/routes";
import { UnmatchedRows } from "../../returns/unmatched/unmatched-rows";
import { setPartyActive } from "../actions";
import { Activity, type Shown } from "./activity";
import { HoldsNow, ThisMonth } from "./holdings";
import { loadParty } from "./load-party";
import { PendingBills } from "./pending-bills";

export const metadata: Metadata = {
  title: "Party · GasFlow",
};

/** The status of bill each choice asks for, or none for either. */
const STATUSES: Record<BillChoice, BillStatus | undefined> = {
  active: "posted",
  cancelled: "cancelled",
  all: undefined,
};

export default async function PartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ partyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  const loaded = await loadParty(params);
  if (!loaded.party) {
    return loaded.failure;
  }
  const { party } = loaded;
  const asked = readPartyPageQuery(await searchParams);
  // A supplier is sent nothing, so it holds nothing and has no days to sum up.
  const holds = holdsCylinders(party.type);
  const query: PartyPageQuery = holds ? asked : { ...asked, view: "bills" };

  return (
    <div className="space-y-8">
      <PageHeading
        title={party.name}
        subtitle={
          <span className="flex items-center gap-2">
            {PARTY_TYPE_NAMES[party.type]}
            {!party.active && <Tag>Inactive</Tag>}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {/* Nothing can be received from an inactive customer. */}
          {party.type === "customer" && party.active && (
            <Link href={receiveEmptiesFromPath(party.id)} className={buttonStyles.primary}>
              Receive empties
            </Link>
          )}
          {holds && (
            <Link href={stockCardPath(party.id)} className={buttonStyles.secondary}>
              Stock card
            </Link>
          )}
          <Link href={`${partyPath(party.id)}/edit`} className={buttonStyles.secondary}>
            Edit
          </Link>
          <ActiveDialog party={party} />
        </div>
      </PageHeading>
      {holds && <Holdings partyId={party.id} />}
      {party.type === "customer" && <Returns customerId={party.id} query={query} />}
      <History partyId={party.id} query={query} views={holds ? ["bills", "daily"] : ["bills"]} />
      <Details party={party} />
    </div>
  );
}

async function Holdings({ partyId }: { partyId: string }) {
  const holding = await orNull(fetchPartyHolding(partyId));
  if (!holding) {
    return (
      <LoadError>
        What the party holds could not be loaded. Check that the API is running, then reload the
        page.
      </LoadError>
    );
  }
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-6">
      <HoldsNow holding={holding} />
      <ThisMonth month={holding.thisMonth} />
    </div>
  );
}

/** What a customer has yet to bring back, and what came back that is on no bill. */
async function Returns({ customerId, query }: { customerId: string; query: PartyPageQuery }) {
  const [pending, unmatched] = await Promise.all([
    orNull(fetchPendingReturns({ customerId, page: query.pendingPage })),
    orNull(fetchUnmatched({ customerId, page: query.unmatchedPage })),
  ]);

  return (
    <>
      <section id="pending" aria-labelledby="pending-heading" className="scroll-mt-20 space-y-3">
        <h2 id="pending-heading" className="text-lg font-semibold">
          Pending bills
        </h2>
        {pending ? (
          <PendingBills
            list={pending}
            pageHref={(page) =>
              partyPageHref(customerId, { ...query, pendingPage: page }, "pending")
            }
          />
        ) : (
          <LoadError>
            The pending bills could not be loaded. Check that the API is running, then reload the
            page.
          </LoadError>
        )}
      </section>
      <section
        id="unmatched"
        aria-labelledby="unmatched-heading"
        className="scroll-mt-20 space-y-3"
      >
        <h2 id="unmatched-heading" className="text-lg font-semibold">
          Unmatched returns
        </h2>
        {/* Kept through a failed load, so that an open box is not lost. */}
        <UnmatchedRows list={unmatched} customerPage={{ customerId, query }} />
      </section>
    </>
  );
}

async function History({
  partyId,
  query,
  views,
}: {
  partyId: string;
  query: PartyPageQuery;
  views: PartyPageQuery["view"][];
}) {
  const { view, bills, from, to, page } = query;
  const shown: Shown =
    view === "daily"
      ? { days: await orNull(fetchDailySummary(partyId, { from, to, page })) }
      : {
          bills: await orNull(
            fetchBills(
              billListQuerySchema.parse({ partyId, status: STATUSES[bills], from, to, page }),
            ),
          ),
        };

  return <Activity partyId={partyId} query={query} shown={shown} views={views} />;
}

/** Deactivates the party, or makes it active again. */
function ActiveDialog({ party: { id, name, type, active } }: { party: Party }) {
  const kept = "Its details and bills are kept, and you can make it active again.";
  return (
    <ActionDialog
      // A new one once this changes, so that its words match.
      key={String(active)}
      trigger={active ? "Deactivate" : "Make active"}
      title={active ? `Deactivate ${name}?` : `Make ${name} active?`}
      description={
        !active
          ? "It will be offered on new entries again."
          : !holdsCylinders(type)
            ? `It will not be offered on anything new. ${kept}`
            : `It will not be offered on anything new. ${kept} A party that holds cylinders or has unmatched returns cannot be deactivated.`
      }
      submitLabel={active ? "Deactivate" : "Make active"}
      danger={active}
      action={setPartyActive.bind(null, id, !active)}
    />
  );
}

function Details({ party }: { party: Party }) {
  const details = [
    ["Abbreviation", party.abbreviation],
    ["Mobile", party.mobile],
    ["Contact person", party.contactPerson],
    ["Address", party.address],
    ["Notes", party.notes],
  ] as const;

  return (
    <section aria-labelledby="details-heading" className="max-w-2xl space-y-3">
      <h2 id="details-heading" className="text-lg font-semibold">
        Details
      </h2>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {details.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-slate-500">{label}</dt>
            <dd className="whitespace-pre-line break-words">
              {value ?? <span className="text-slate-400">Not given</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
