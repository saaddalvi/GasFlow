import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { buttonStyles } from "@/components/button-styles";
import { fetchGases, fetchStartDate, fetchToday, orNull } from "@/lib/api";
import { OPENING_STOCK_PATH, UNMATCHED_RETURNS_PATH } from "@/lib/routes";
import { ReceiveForm, type FormChoices } from "./receive-form";

export const metadata: Metadata = {
  title: "Receive empties · GasFlow",
};

export default async function ReceiveEmptiesPage() {
  await auth.protect();
  const [setup, today, gases] = await Promise.all([
    orNull(fetchStartDate()),
    orNull(fetchToday()),
    orNull(fetchGases()),
  ]);
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
        <Link href={UNMATCHED_RETURNS_PATH} className={buttonStyles.secondary}>
          Unmatched returns
        </Link>
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
        <ReceiveForm choices={choices} />
      )}
    </div>
  );
}
