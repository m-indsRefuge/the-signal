import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".agents/**",
      ".react-router/**",
      ".wrangler/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "worker-configuration.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["app/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
  },
  {
    files: ["workers/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.worker,
      },
    },
  },
  {
    files: ["eslint.config.mjs", "vite.config.ts", "react-router.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
);
