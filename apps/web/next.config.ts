import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Stops `next dev` from writing its own AGENTS.md into the repository.
  agentRules: false,
  // `next dev` would otherwise print each Server Function's arguments, among them
  // the passwords typed on the Staff screen.
  logging: { serverFunctions: false },
  // The shared package ships TypeScript source.
  transpilePackages: ["@gasflow/shared"],
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
};

export default config;
