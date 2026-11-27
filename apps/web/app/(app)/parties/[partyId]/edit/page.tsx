import { PARTY_TYPE_NAMES } from "@gasflow/shared";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { loadParty } from "../load-party";
import { PartyForm } from "../../party-form";

export const metadata: Metadata = {
  title: "Edit party · GasFlow",
};

export default async function EditPartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  await auth.protect();
  const loaded = await loadParty(params);
  if (!loaded.party) {
    return loaded.failure;
  }
  const { party } = loaded;

  return (
    <div className="space-y-8">
      <PageHeading title={`Edit ${party.name}`} subtitle={PARTY_TYPE_NAMES[party.type]} />
      <PartyForm party={party} />
    </div>
  );
}
