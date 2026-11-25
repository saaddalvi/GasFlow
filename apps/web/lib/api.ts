import { gasListSchema, type GasList } from "@gasflow/shared";

/** Asks the API for the gases. Runs on the web server, never in the browser. */
export async function fetchGases(): Promise<GasList> {
  return gasListSchema.parse(await getJson("/api/gases"));
}

async function getJson(path: string): Promise<unknown> {
  const baseUrl = process.env.API_URL;
  if (!baseUrl) {
    throw new Error("API_URL is not set. See .env.example.");
  }
  const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path}.`);
  }
  return response.json();
}
