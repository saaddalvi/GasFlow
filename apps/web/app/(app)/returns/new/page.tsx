import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { fetchStartDate, fetchToday, orNull } from "@/lib/api";
import { OPENING_STOCK_PATH } from "@/lib/routes";
import { ReceiveForm, type FormDates } from "./receive-form";

export const metadata: Metadata = {
  title: "Receive empties · GasFlow",
};

export default async function ReceiveEmptiesPage() {
  await auth.protect();
  const [setup, today] = await Promise.all([orNull(fetchStartDate()), orNull(fetchToday())]);
  const dates: FormDates | null =
    setup?.startDate && today ? { startDate: setup.startDate, today } : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Receive empties"
        subtitle="Cylinders a customer has brought back, against the bills they went out on."
      />
      {setup && !setup.startDate ? (
        <EmptyState>
          An admin has to set the start date, on the{" "}
          <Link href={OPENING_STOCK_PATH} className="text-brand-700 underline">
            Opening stock
          </Link>{" "}
          page, before empties are received.
        </EmptyState>
      ) : (
        <ReceiveForm dates={dates} />
      )}
    </div>
  );
}
