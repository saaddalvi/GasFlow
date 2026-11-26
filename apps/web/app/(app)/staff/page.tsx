import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/load-error";
import { PageHeading } from "@/components/page-heading";
import { fetchMe, fetchStaff, orNull } from "@/lib/api";
import { AddStaffForm } from "./add-staff-form";
import { StaffList } from "./staff-list";

export const metadata: Metadata = {
  title: "Staff · GasFlow",
};

export default async function StaffPage() {
  await auth.protect();
  const me = await orNull(fetchMe());
  // Only admins have this screen. The API refuses everyone else whatever is shown here.
  if (me && !me.isAdmin) {
    notFound();
  }
  const list = me && (await orNull(fetchStaff()));

  return (
    <div className="space-y-8">
      <PageHeading title="Staff" subtitle="Who can sign in, and who is an admin." />
      {me && list ? (
        <>
          <AddStaffForm />
          <StaffList staff={list.staff} ownId={me.id} />
        </>
      ) : (
        <LoadError>
          The staff list could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      )}
    </div>
  );
}
