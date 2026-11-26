import { auth } from "@clerk/nextjs/server";
import { pendingQuerySchema } from "@gasflow/shared";
import { fetchPending } from "@/lib/api";
import { answerLookup } from "@/lib/lookup-route";

/**
 * What a customer can return cylinders against on a date, for Receive empties,
 * matching and customer write-offs.
 */
export async function GET(request: Request) {
  await auth.protect();
  return answerLookup(request, pendingQuerySchema, fetchPending);
}
