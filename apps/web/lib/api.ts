import { auth } from "@clerk/nextjs/server";
import {
  gasListSchema,
  shopSchema,
  staffSchema,
  type GasList,
  type Shop,
  type Staff,
} from "@gasflow/shared";

// Everything here runs on the web server, never in the browser, and asks the API
// on behalf of the signed-in staff member.

export async function fetchGases(): Promise<GasList> {
  return gasListSchema.parse(await getJson("/api/gases"));
}

export async function fetchShop(): Promise<Shop> {
  return shopSchema.parse(await getJson("/api/shop"));
}

export async function fetchMe(): Promise<Staff> {
  return staffSchema.parse(await getJson("/api/me"));
}

/** The answer, or null with the reason logged, for a page to show its own message. */
export function orNull<T>(answer: Promise<T>): Promise<T | null> {
  return answer.catch((error: unknown) => {
    console.error(error);
    return null;
  });
}

async function getJson(path: string): Promise<unknown> {
  const baseUrl = process.env.API_URL;
  if (!baseUrl) {
    throw new Error("API_URL is not set. See .env.example.");
  }
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error(`No one is signed in to ask the API for ${path}.`);
  }
  const response = await fetch(new URL(path, baseUrl), {
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path}.`);
  }
  return response.json();
}
