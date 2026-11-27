import { auth } from "@clerk/nextjs/server";
import { stockCardQuerySchema } from "@gasflow/shared";
import { fetchStockCardCsv } from "@/lib/api";
import { passOnFile } from "@/lib/pass-on-file";

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
  return passOnFile(await fetchStockCardCsv(query.data));
}
