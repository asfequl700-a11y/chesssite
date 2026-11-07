import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The chess.js game object lives in a ref and a `fen` state triggers re-renders (on purpose).
  // These React Compiler rules flag that pattern; we don't use the compiler.
  { rules: { "react-hooks/refs": "off", "react-hooks/set-state-in-effect": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/**", "docs/**", "public/**",
  ]),
]);

export default eslintConfig;
