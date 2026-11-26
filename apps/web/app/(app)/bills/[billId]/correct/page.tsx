import { auth } from "@clerk/nextjs/server";
import { billName, whyNotCorrect, whyUncorrectable, type Bill } from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import {
  fetchBill,
  fetchGases,
  fetchMe,
  fetchStartDate,
  fetchToday,
  fetchVehicles,
  orNull,
} from "@/lib/api";
import { BILL_TYPE_NAMES } from "@/lib/bill-names";
import { billPath } from "@/lib/routes";
import { CorrectionForm, type Correctable } from "./correction-form";

export const metadata: Metadata = {
  title: "Correct bill · GasFlow",
};

export default async function CorrectBillPage({ params }: { params: Promise<{ billId: string }> }) {
  await auth.protect();
  const { billId } = await params;
  const [bill, me, today, setup, gases, vehicles] = await Promise.all([
    orNull(fetchBill(billId)),
    orNull(fetchMe()),
    orNull(fetchToday()),
    orNull(fetchStartDate()),
    orNull(fetchGases({ retired: true })),
    orNull(fetchVehicles({ inactive: true })),
  ]);
  if (bill === undefined) {
    notFound();
  }
  // Why this bill is not to be corrected. The API refuses whatever is shown here.
  const refusal =
    bill && me && today ? (whyUncorrectable(bill) ?? whyNotCorrect(bill, me, today)) : null;
  const correctable: Correctable | null =
    bill && me && today && !refusal && setup?.startDate && gases && vehicles
      ? {
          bill,
          choices: {
            isAdmin: me.isAdmin,
            startDate: setup.startDate,
            today,
            // What the bill already names stays on offer, though no longer in use.
            gases: gases.gases.filter(
              (gas) => gas.active || bill.lines.some((line) => line.gas.id === gas.id),
            ),
            vehicles: vehicles.vehicles.filter(
              (vehicle) => vehicle.active || vehicle.id === bill.vehicle?.id,
            ),
          },
        }
      : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title={bill ? `Correct ${nameOf(bill)}` : "Correct bill"}
        subtitle={
          bill
            ? `${BILL_TYPE_NAMES[bill.type]}${bill.type === "opening_stock" ? ` · ${bill.to?.name}` : ""}. What it says now is kept as an earlier version.`
            : "What it says now is kept as an earlier version."
        }
      >
        <Link href={billPath(billId)} className="text-sm text-brand-700 hover:underline">
          Back to the bill
        </Link>
      </PageHeading>
      <CorrectionForm key={billId} correctable={correctable}>
        {refusal ? (
          <EmptyState>{refusal}</EmptyState>
        ) : (
          <LoadError>
            The form could not be loaded. Check that the API is running, then reload the page.
          </LoadError>
        )}
      </CorrectionForm>
    </div>
  );
}

/** What staff call the bill. Opening stock goes by that, not its number. */
function nameOf(bill: Bill): string {
  return bill.type === "opening_stock" ? "opening stock" : billName(bill);
}
