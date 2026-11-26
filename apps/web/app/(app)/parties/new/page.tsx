import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PartyForm } from "../party-form";

export const metadata: Metadata = {
  title: "Add party · GasFlow",
};

export default async function NewPartyPage() {
  await auth.protect();

  return (
    <div className="space-y-8">
      <PageHeading title="Add party" subtitle="A customer, refiller or supplier." />
      <PartyForm />
    </div>
  );
}
