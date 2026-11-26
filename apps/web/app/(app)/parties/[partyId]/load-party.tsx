import type { Party } from "@gasflow/shared";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/load-error";
import { fetchParty, orNull } from "@/lib/api";

/**
 * The party a page is about, or what to show when it could not be loaded. A party
 * that does not exist gets the "not found" page.
 */
export async function loadParty(
  params: Promise<{ partyId: string }>,
): Promise<{ party: Party } | { party?: undefined; failure: React.ReactNode }> {
  const { partyId } = await params;
  const party = await orNull(fetchParty(partyId));
  if (party === undefined) {
    notFound();
  }
  if (party === null) {
    return {
      failure: (
        <LoadError>
          The party could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      ),
    };
  }
  return { party };
}
