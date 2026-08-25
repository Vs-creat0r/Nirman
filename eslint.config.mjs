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
      "@typescript-eslint/no-explicit-any": "error",
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["../*"], message: "Use @/ imports, never relative paths." }]
      }],
      "no-console": ["error", { allow: ["error"] }],
    },
  },
 
  // generated files are exempt
  {
    files: ["convex/_generated/**", "convex/schema.ts", "lib/schemas/**", "lib/contract-types.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "max-lines": "off",
      "no-restricted-imports": "off",
    },
  },
]);


export default eslintConfig;
