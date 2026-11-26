import { auth } from "@clerk/nextjs/server";
import { splitQuerySchema } from "@gasflow/shared";
import { fetchSplit } from "@/lib/api";
import { answerLookup } from "@/lib/lookup-route";

/** How "Fill oldest first" would split a total of a gas, for Receive empties. */
export async function GET(request: Request) {
  await auth.protect();
  return answerLookup(request, splitQuerySchema, fetchSplit);
}
