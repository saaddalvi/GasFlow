import { auth } from "@clerk/nextjs/server";
import type { Party } from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionDialog } from "@/components/action-dialog";
import { buttonStyles } from "@/components/button-styles";
import { PageHeading } from "@/components/page-heading";
import { Tag } from "@/components/tag";
import { PARTY_TYPE_NAMES } from "@/lib/party-types";
import { setPartyActive } from "../actions";
import { loadParty } from "./load-party";

export const metadata: Metadata = {
  title: "Party · GasFlow",
};

export default async function PartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  await auth.protect();
  const loaded = await loadParty(params);
  if (!loaded.party) {
    return loaded.failure;
  }
  const { party } = loaded;

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
          <Link href={`/parties/${party.id}/edit`} className={buttonStyles.secondary}>
            Edit
          </Link>
          <ActiveDialog party={party} />
        </div>
      </PageHeading>
      <Details party={party} />
    </div>
  );
}

/** Deactivates the party, or makes it active again. */
function ActiveDialog({ party: { id, name, active } }: { party: Party }) {
  return (
    <ActionDialog
      // A new one once this changes, so that its words match.
      key={String(active)}
      trigger={active ? "Deactivate" : "Make active"}
      title={active ? `Deactivate ${name}?` : `Make ${name} active?`}
      description={
        active
          ? "It will not be offered on anything new. Its details are kept, and you can make it active again."
          : "It will be offered on new entries again."
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
    <dl className="max-w-2xl divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {details.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">{label}</dt>
          <dd className="whitespace-pre-line break-words">
            {value ?? <span className="text-slate-400">Not given</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
