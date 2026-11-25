import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client, escapeIdentifier } from "pg";
import { databaseName, testDatabaseUrl } from "./test-database";

/** Creates the test database if needed and brings it up to the latest migration. */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  await createDatabaseIfMissing(url);

  execFileSync("prisma", ["migrate", "deploy"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

async function createDatabaseIfMissing(url: string): Promise<void> {
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = "/postgres";

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const name = databaseName(url);
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${escapeIdentifier(name)}`);
    }
  } finally {
    await client.end();
  }
}
