import { auth } from "@clerk/nextjs/server";
import { billNumberUseQuerySchema } from "@gasflow/shared";
import { fetchNumberUse } from "@/lib/api";

/** Whether a bill number is taken, for the new bill form to say while it is typed. */
export async function GET(request: Request) {
  await auth.protect();
  const asked = Object.fromEntries(new URL(request.url).searchParams);
  const query = billNumberUseQuerySchema.safeParse(asked);
  if (!query.success) {
    return new Response(null, { status: 400 });
  }
  return Response.json(await fetchNumberUse(query.data));
}
