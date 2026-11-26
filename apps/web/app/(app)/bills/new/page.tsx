import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { fetchGases, fetchStartDate, fetchToday, fetchVehicles, orNull } from "@/lib/api";
import { OPENING_STOCK_PATH } from "@/lib/routes";
import { DispatchForm, type FormChoices } from "./dispatch-form";

export const metadata: Metadata = {
  title: "New bill · GasFlow",
};

export default async function NewBillPage() {
  await auth.protect();
  const [setup, today, gases, vehicles] = await Promise.all([
    orNull(fetchStartDate()),
    orNull(fetchToday()),
    orNull(fetchGases()),
    orNull(fetchVehicles()),
  ]);
  const choices: FormChoices | null =
    setup?.startDate && today && gases && vehicles
      ? { startDate: setup.startDate, today, gases: gases.gases, vehicles: vehicles.vehicles }
      : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="New bill"
        subtitle="A dispatch from the shop to a customer, copied from the paper."
      />
      {setup && !setup.startDate ? (
        <EmptyState>
          An admin has to set the start date, on the{" "}
          <Link href={OPENING_STOCK_PATH} className="text-brand-700 underline">
            Opening stock
          </Link>{" "}
          page, before bills are entered.
        </EmptyState>
      ) : (
        <DispatchForm choices={choices} />
      )}
    </div>
  );
}
