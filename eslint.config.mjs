import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // shadcn/ui generated primitives — vendored code we don't hand-edit.
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Zod must be configured for the page CSP before any schema is built (src/lib/zod.ts).
    files: ["src/**"],
    ignores: ["src/lib/zod.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "zod", message: 'Import { z } from "@/lib/zod" instead.' }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
