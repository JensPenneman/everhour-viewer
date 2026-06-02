import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Type safety
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // React
      "react/no-unescaped-entities": "off",
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }],

      // Imports
      "import/order": "off",

      // Style
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      eqeqeq: ["error", "smart"],
      curly: ["error", "multi-line"],
    },
  },
  // Module boundaries — keep the dependency graph one-directional.
  {
    files: ["lib/**/*.{ts,tsx}", "shared/ui/**/*.{ts,tsx}", "shared/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/*/**"],
              message:
                "The shared kernel (lib/, shared/ui, shared/hooks) must not import feature modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/*/**", "@/shared/*", "@/shared/*/**"],
              message: "Server code must not import client feature/shared modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["scripts/**/*"],
    rules: {
      "no-console": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "screenshots/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
