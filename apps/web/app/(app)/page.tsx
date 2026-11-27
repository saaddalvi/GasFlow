import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { NoRecords } from "@/components/report-day";
import { fetchDashboard, fetchMe, orNull } from "@/lib/api";
import { formatDateInFull } from "@/lib/dates";
import { Cylinders } from "./dashboard/cylinders";
import { QuickActions } from "./dashboard/quick-actions";
import { Today } from "./dashboard/today";

export const metadata: Metadata = {
  title: "Dashboard · GasFlow",
};

export default async function DashboardPage() {
  await auth.protect();
  const [dashboard, me] = await Promise.all([orNull(fetchDashboard()), orNull(fetchMe())]);

  return (
    <div className="space-y-8">
      <PageHeading
        title={me ? `Welcome, ${me.displayName}` : "Welcome"}
        subtitle={
          dashboard
            ? `Here's where things stand today, ${formatDateInFull(dashboard.date)}.`
            : "Here's where things stand today."
        }
      />
      {!dashboard ? (
        <LoadError>
          Today&apos;s figures could not be loaded. Check that the API is running, then reload the
          page.
        </LoadError>
      ) : !dashboard.startDate ? (
        <NoRecords startDate={null} />
      ) : (
        <>
          <Today dashboard={dashboard} startDate={dashboard.startDate} />
          <Cylinders dashboard={dashboard} />
        </>
      )}
      {/* Only admins enter opening stock. */}
      <QuickActions isAdmin={me?.isAdmin ?? false} />
    </div>
  );
}
