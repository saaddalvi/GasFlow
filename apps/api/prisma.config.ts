import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Left empty when unset so that `prisma generate` works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
