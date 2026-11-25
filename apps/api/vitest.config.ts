import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/support/global-setup.ts"],
    setupFiles: ["test/support/reset-database.ts"],
    // Every test shares one database, so test files must not run side by side.
    fileParallelism: false,
  },
});
