import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export interface Config {
  databaseUrl: string;
  host: string;
  port: number;
}

export function loadConfig(): Config {
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid settings. See .env.example.\n${z.prettifyError(result.error)}`);
  }
  const { DATABASE_URL, API_HOST, API_PORT } = result.data;
  return { databaseUrl: DATABASE_URL, host: API_HOST, port: API_PORT };
}
