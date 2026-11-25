import { z } from "zod";
import type { ClerkSettings } from "./clerk-identity";

const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLERK_SECRET_KEY: z.string().startsWith("sk_", "Set it to the Clerk secret key."),
  // Comma-separated origins, such as "https://app.example.com".
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),
});

export interface Config {
  databaseUrl: string;
  host: string;
  port: number;
  clerk: ClerkSettings;
}

export function loadConfig(): Config {
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid settings. See .env.example.\n${z.prettifyError(result.error)}`);
  }
  const { DATABASE_URL, API_HOST, API_PORT, CLERK_SECRET_KEY } = result.data;
  const authorizedParties = result.data.CLERK_AUTHORIZED_PARTIES?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    databaseUrl: DATABASE_URL,
    host: API_HOST,
    port: API_PORT,
    clerk: {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties: authorizedParties?.length ? authorizedParties : undefined,
    },
  };
}
