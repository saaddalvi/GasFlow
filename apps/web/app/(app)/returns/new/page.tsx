import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { buttonStyles } from "@/components/button-styles";
import { fetchGases, fetchParty, fetchStartDate, fetchToday, orNull } from "@/lib/api";
import { OPENING_STOCK_PATH, PENDING_RETURNS_PATH, UNMATCHED_RETURNS_PATH } from "@/lib/routes";
import { ReceiveForm, type FormChoices } from "./receive-form";

export const metadata: Metadata = {
  title: "Receive empties · GasFlow",
};

export default async function ReceiveEmptiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  const { customerId } = await searchParams;
  const asked = typeof customerId === "string" ? customerId : "";
  const [setup, today, gases, party] = await Promise.all([
    orNull(fetchStartDate()),
    orNull(fetchToday()),
    orNull(fetchGases()),
    asked ? orNull(fetchParty(asked)) : null,
  ]);
  // Only what the picker would offer. Otherwise the form starts with nobody.
  const startingCustomer =
    party?.type === "customer" && party.active ? { id: party.id, name: party.name } : null;
  const choices: FormChoices | null =
    setup?.startDate && today && gases
      ? { startDate: setup.startDate, today, gases: gases.gases }
      : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Receive empties"
        subtitle="Cylinders a customer has brought back, against the bills they went out on."
      >
        <div className="flex flex-wrap gap-2">
          <Link href={PENDING_RETURNS_PATH} className={buttonStyles.secondary}>
            Pending returns
          </Link>
          <Link href={UNMATCHED_RETURNS_PATH} className={buttonStyles.secondary}>
            Unmatched returns
          </Link>
        </div>
      </PageHeading>
      {setup && !setup.startDate ? (
        <EmptyState>
          An admin has to set the start date, on the{" "}
          <Link href={OPENING_STOCK_PATH} className="text-brand-700 underline">
            Opening stock
          </Link>{" "}
          page, before empties are received.
        </EmptyState>
      ) : (
        // Starts afresh when the address names someone else, or nobody.
        <ReceiveForm key={asked} choices={choices} startingCustomer={startingCustomer} />
      )}
    </div>
  );
}
