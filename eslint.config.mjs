import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "max-lines": ["warn", { max: 1500, skipBlankLines: true, skipComments: true }],
      "no-restricted-imports": ["warn", {
        patterns: [{ group: ["../*"], message: "Use @/ imports, never relative paths." }]
      }],
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "react-hooks/set-state-in-effect": "off",
      "prefer-const": "warn",
    },
  },
 
  // generated, backend, and test files are exempt from strict UI line caps and test mocks
  {
    files: [
      "convex/**",
      "convex/_generated/**",
      "convex/schema.ts",
      "lib/schemas/**",
      "lib/contract-types.ts",
      "components/document/**",
      "tests/**"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "max-lines": "off",
      "no-restricted-imports": "off",
    },
  },
]);


export default eslintConfig;
