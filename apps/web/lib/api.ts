import { auth } from "@clerk/nextjs/server";
import {
  gasListSchema,
  refusalSchema,
  shopSchema,
  staffListSchema,
  staffSchema,
  type GasList,
  type Shop,
  type Staff,
  type StaffList,
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

export async function fetchStaff(): Promise<StaffList> {
  return staffListSchema.parse(await getJson("/api/staff"));
}

/** How a change went: nothing to say, or why it was not made. */
export interface Outcome {
  error?: string;
}

/** Asks the API to change something. */
export async function sendChange(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Outcome> {
  try {
    const response = await askApi(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.ok) {
      return {};
    }
    // A refusal says why, in words for the person. A server error does not.
    if (response.status < 500) {
      return { error: refusalSchema.parse(await response.json()).message };
    }
    console.error(`The API answered ${response.status} for ${method} ${path}.`);
  } catch (error) {
    console.error(error);
  }
  return { error: "Something went wrong. Check whether the change was made, then try again." };
}

/** The answer, or null with the reason logged, for a page to show its own message. */
export function orNull<T>(answer: Promise<T>): Promise<T | null> {
  return answer.catch((error: unknown) => {
    console.error(error);
    return null;
  });
}

async function getJson(path: string): Promise<unknown> {
  const response = await askApi(path);
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path}.`);
  }
  return response.json();
}

async function askApi(
  path: string,
  { headers, ...init }: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const baseUrl = process.env.API_URL;
  if (!baseUrl) {
    throw new Error("API_URL is not set. See .env.example.");
  }
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error(`No one is signed in to ask the API for ${path}.`);
  }
  return fetch(new URL(path, baseUrl), {
    ...init,
    cache: "no-store",
    headers: { ...headers, authorization: `Bearer ${token}` },
  });
}
