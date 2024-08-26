import {FlatCompat} from "@eslint/eslintrc";
import js from "@eslint/js";
import deprecation from "eslint-plugin-deprecation";
import prettier from "eslint-plugin-prettier";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: [
      "dist",
      "tmp",
      ".tmp",
      "out-tsc",
      "bazel-out",
      "**/node_modules",
      "**/chrome-profiler-events*.json",
      "**/speed-measure-plugin*.json",
      ".idea",
      "**/.project",
      "**/.classpath",
      "**/.c9/",
      "**/*.launch",
      "**/.settings/",
      "**/*.sublime-workspace",
      ".vscode/*",
      "!.vscode/settings.json",
      "!.vscode/tasks.json",
      "!.vscode/launch.json",
      "!.vscode/extensions.json",
      ".history/*",
      ".angular/cache",
      ".sass-cache",
      "connect.lock",
      "coverage",
      "libpeerconnection.log",
      "**/npm-debug.log",
      "**/yarn-error.log",
      "**/testem.log",
      "typings",
      "**/.DS_Store",
      "**/Thumbs.db",
      "**/.yarn",
      "/lib",
      "/dist",
      "/test",
      "src/assets/json"
    ]
  },
  {
    languageOptions: {
      globals: {}
    },

    rules: {}
  },
  ...compat
    .extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@angular-eslint/recommended",
      "plugin:@angular-eslint/template/process-inline-templates",
      "plugin:prettier/recommended"
    )
    .map((config) => ({
      ...config,
      files: ["**/*.ts"]
    })),
  {
    files: ["**/*.ts"],

    plugins: {
      deprecation,
      prettier
    },

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: ["tsconfig.json", "scripts/tsconfig.scripts.json", "cypress/tsconfig.json"],
        createDefaultProgram: true
      }
    },

    rules: {
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case"
        }
      ],

      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase"
        }
      ],

      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: null,
          leadingUnderscore: "allowSingleOrDouble"
        }
      ],

      "@typescript-eslint/no-explicit-any": "off",
      // "deprecation/deprecation": "warn",

      "no-empty": [
        "error",
        {
          allowEmptyCatch: true
        }
      ]
    }
  },
  ...compat.extends("plugin:@angular-eslint/template/recommended").map((config) => ({
    ...config,
    files: ["**/*.component.html", "**/index.html"]
  })),
  {
    files: ["**/*.component.html", "**/index.html"],
    rules: {}
  },
  ...compat.extends("plugin:@angular-eslint/template/process-inline-templates").map((config) => ({
    ...config,
    files: ["**/*.component.ts"]
  }))
];
