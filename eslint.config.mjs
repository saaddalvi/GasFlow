import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/node_modules/", "**/.next/", "**/next-env.d.ts", "apps/api/src/generated/"]),
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [nextPlugin.configs["core-web-vitals"], reactHooks.configs.flat.recommended],
    settings: { next: { rootDir: "apps/web/" } },
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { globals: globals.node },
  },
);
