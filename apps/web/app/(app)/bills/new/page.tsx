import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { fetchGases, fetchMe, fetchStartDate, fetchToday, fetchVehicles, orNull } from "@/lib/api";
import { OPENING_STOCK_PATH } from "@/lib/routes";
import { BillForm, type FormChoices } from "./bill-form";

export const metadata: Metadata = {
  title: "New bill · GasFlow",
};

export default async function NewBillPage() {
  await auth.protect();
  const [me, setup, today, gases, vehicles] = await Promise.all([
    orNull(fetchMe()),
    orNull(fetchStartDate()),
    orNull(fetchToday()),
    orNull(fetchGases()),
    orNull(fetchVehicles()),
  ]);
  const choices: FormChoices | null =
    me && setup?.startDate && today && gases && vehicles
      ? {
          isAdmin: me.isAdmin,
          startDate: setup.startDate,
          today,
          gases: gases.gases,
          vehicles: vehicles.vehicles,
        }
      : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="New bill"
        subtitle={
          me?.isAdmin
            ? "Cylinders moving to or from the shop, or joining or leaving the business."
            : "Cylinders going out from the shop or coming back from a refiller, copied from the paper."
        }
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
        <BillForm choices={choices} />
      )}
    </div>
  );
}
