import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Playwright fixtures call their `use` callback, which the React hooks rule mistakes for a hook.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Browser and shared code must not pull server modules (DB client, secrets) into the client bundle.
    files: ["src/lib/**", "src/components/**", "src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/server/*", "**/server/*"], message: "Shared rules live in @/domain." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied from maplibre-gl by scripts/copy-maplibre-worker.mjs.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
