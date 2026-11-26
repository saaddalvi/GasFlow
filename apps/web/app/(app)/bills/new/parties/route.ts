import { auth } from "@clerk/nextjs/server";
import { partyListQuerySchema } from "@gasflow/shared";
import { fetchParties } from "@/lib/api";

/**
 * The active parties of one type whose names match, for the picker on the new bill
 * form. A route rather than a Server Function, which would wait its turn behind
 * others.
 */
export async function GET(request: Request) {
  await auth.protect();
  const asked = new URL(request.url).searchParams;
  const query = partyListQuerySchema.safeParse({
    search: asked.get("search") ?? "",
    type: asked.get("type"),
  });
  if (!query.success) {
    return new Response(null, { status: 400 });
  }
  return Response.json(await fetchParties(query.data));
}
