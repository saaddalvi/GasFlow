import { loadConfig } from "../src/config";
import { createDatabase } from "../src/database";
import { seedDatabase } from "../src/seed";

const db = createDatabase(loadConfig().databaseUrl);
try {
  await seedDatabase(db);
  console.log("Seeded the shop and the starting gases.");
} finally {
  await db.$disconnect();
}
