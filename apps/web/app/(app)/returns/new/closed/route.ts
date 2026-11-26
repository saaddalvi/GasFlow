import { auth } from "@clerk/nextjs/server";
import { closedRowListQuerySchema } from "@gasflow/shared";
import { fetchClosedRows } from "@/lib/api";
import { answerLookup } from "@/lib/lookup-route";

/** A page of a customer's rows with nothing pending, for Receive empties. */
export async function GET(request: Request) {
  await auth.protect();
  return answerLookup(request, closedRowListQuerySchema, fetchClosedRows);
}
