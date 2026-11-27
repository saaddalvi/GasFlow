import { auth } from "@clerk/nextjs/server";
import { partyListQuerySchema } from "@gasflow/shared";
import { fetchParties } from "@/lib/api";
import { answerLookup } from "@/lib/lookup-route";

/**
 * The customers and refillers whose names match, inactive ones too, for the
 * picker on the stock card.
 */
export async function GET(request: Request) {
  await auth.protect();
  const schema = partyListQuerySchema.transform((query) => ({
    ...query,
    holders: true,
    inactive: true,
  }));
  return answerLookup(request, schema, fetchParties);
}
