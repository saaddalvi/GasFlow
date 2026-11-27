import { auth } from "@clerk/nextjs/server";
import { stockCardQuerySchema } from "@gasflow/shared";
import { fetchStockCardCsv } from "@/lib/api";

/**
 * The stock card as a file to save. The browser asks this web app, which asks the
 * API on behalf of whoever is signed in.
 */
export async function GET(request: Request) {
  await auth.protect();
  const query = stockCardQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return new Response(null, { status: 400 });
  }
  const answer = await fetchStockCardCsv(query.data);
  if (!answer.ok) {
    return new Response(null, { status: answer.status });
  }
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition"]) {
    const value = answer.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(answer.body, { headers });
}
