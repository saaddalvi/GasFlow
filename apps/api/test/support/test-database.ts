/**
 * The database the tests empty and refill. The name check stops a mistyped
 * setting from wiping a development or production database.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  }
  if (!databaseName(url).endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must name a database ending in _test.");
  }
  return url;
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}
