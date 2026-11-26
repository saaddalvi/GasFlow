import { auth } from "@clerk/nextjs/server";
import { refillerRefillerSlipNumberUseQuerySchema } from "@gasflow/shared";
import { fetchRefillerSlipNumberUse } from "@/lib/api";

/** Whether a refiller's slip number is taken, for the new bill form to say while it is typed. */
export async function GET(request: Request) {
  await auth.protect();
  const asked = Object.fromEntries(new URL(request.url).searchParams);
  const query = refillerRefillerSlipNumberUseQuerySchema.safeParse(asked);
  if (!query.success) {
    return new Response(null, { status: 400 });
  }
  return Response.json(await fetchRefillerSlipNumberUse(query.data));
}
