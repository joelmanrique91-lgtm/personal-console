import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"]
  },
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@typescript-eslint": tsPlugin
    },
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: { version: "detect" }
    },
    rules: {
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-refresh/only-export-components": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  prettier
];
