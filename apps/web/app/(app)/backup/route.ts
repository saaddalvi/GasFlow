import { auth } from "@clerk/nextjs/server";
import { fetchBackup } from "@/lib/api";
import { passOnFile } from "@/lib/pass-on-file";

/**
 * The offline backup as a file to save. The browser asks this web app, which asks
 * the API on behalf of whoever is signed in.
 */
export async function GET() {
  await auth.protect();
  return passOnFile(await fetchBackup());
}
