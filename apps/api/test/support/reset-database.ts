import { escapeIdentifier } from "pg";
import { afterAll, beforeEach } from "vitest";
import { createDatabase } from "../../src/database";
import { seedDatabase } from "../../src/seed";
import { testDatabaseUrl } from "./test-database";

const db = createDatabase(testDatabaseUrl());

// Every test starts from the same known data: empty tables, then the seed.
beforeEach(async () => {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const list = tables.map(({ tablename }) => escapeIdentifier(tablename)).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});
