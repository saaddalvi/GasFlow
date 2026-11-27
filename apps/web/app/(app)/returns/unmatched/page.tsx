import { auth } from "@clerk/nextjs/server";
import { unmatchedListQuerySchema } from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { PageHeading } from "@/components/page-heading";
import { fetchUnmatched, orNull } from "@/lib/api";
import { RECEIVE_EMPTIES_PATH } from "@/lib/routes";
import { UnmatchedRows } from "./unmatched-rows";

export const metadata: Metadata = {
  title: "Unmatched returns · GasFlow",
};

export default async function UnmatchedReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  // An address typed by hand that asks for nonsense gets the first page.
  // Every customer's, whatever else it asks for.
  const asked = unmatchedListQuerySchema.pick({ page: true }).safeParse(await searchParams);
  const list = await orNull(fetchUnmatched(asked.data ?? { page: 1 }));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Unmatched returns"
        subtitle="Cylinders that came back beyond everything pending, and are not yet on a bill. The oldest first."
      >
        <Link href={RECEIVE_EMPTIES_PATH} className={buttonStyles.secondary}>
          Receive empties
        </Link>
      </PageHeading>
      {/* Kept through a failed load, so that an open box is not lost. */}
      <UnmatchedRows list={list} />
    </div>
  );
}
