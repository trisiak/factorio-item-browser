const js = require("@eslint/js");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const jestPlugin = require("eslint-plugin-jest");
const importPlugin = require("eslint-plugin-import");
const prettierRecommended = require("eslint-plugin-prettier/recommended");

// Flat-config port of the previous .eslintrc. Rule intent is preserved:
// eslint:recommended + react/recommended + @typescript-eslint/recommended +
// import warnings + jest/recommended (test files) + prettier, with the same
// explicit rule overrides. The webpack import resolver did not survive the
// flat-config move, so module resolution now runs through the TypeScript
// resolver (eslint-import-resolver-typescript).
module.exports = [
    {
        ignores: ["build/**", "node_modules/**", "e2e/**", "type/**", "*.config.js"],
    },
    js.configs.recommended,
    ...tsPlugin.configs["flat/recommended"],
    reactPlugin.configs.flat.recommended,
    importPlugin.flatConfigs.warnings,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                warnOnUnsupportedTypeScriptVersion: false,
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
                process: "readonly",
            },
        },
        settings: {
            "import/resolver": {
                typescript: true,
                node: true,
            },
            "react": {
                version: "detect",
            },
        },
        rules: {
            "@typescript-eslint/explicit-member-accessibility": "error",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
            "import/order": [
                "error",
                {
                    "newlines-between": "never",
                    "alphabetize": { order: "asc" },
                },
            ],
            "no-constant-condition": ["error", { checkLoops: false }],
            "react/prop-types": 0,
        },
    },
    {
        files: ["**/*.test.{ts,tsx}"],
        ...jestPlugin.configs["flat/recommended"],
        languageOptions: {
            globals: { ...globals.jest },
        },
    },
    prettierRecommended,
];
