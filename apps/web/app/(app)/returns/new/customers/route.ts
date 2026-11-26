import { auth } from "@clerk/nextjs/server";
import { returnCustomerListQuerySchema } from "@gasflow/shared";
import { fetchReturnCustomers } from "@/lib/api";
import { answerLookup } from "@/lib/lookup-route";

/**
 * The active customers whose names match, with what each has pending, for the
 * picker on Receive empties. A route rather than a Server Function, which would
 * wait its turn behind others.
 */
export async function GET(request: Request) {
  await auth.protect();
  return answerLookup(request, returnCustomerListQuerySchema, fetchReturnCustomers);
}
