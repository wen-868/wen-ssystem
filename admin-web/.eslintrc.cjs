module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: "@typescript-eslint/parser",
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ["vue", "@typescript-eslint"],
  rules: {
    // 统一规则
    "vue/multi-word-component-names": "off",
    "no-console": "warn",
    "no-debugger": "error",

    // Vue 规则
    "vue/html-indent": ["error", 2],
    "vue/max-attributes-per-line": "off",
    "vue/singleline-html-element-content-newline": "off",
    "vue/html-self-closing": "off",
    "vue/require-default-prop": "off",
    "vue/require-prop-types": "off",

    // TypeScript 规则
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

    // 通用规则
    "no-unused-vars": "off",
    "prefer-const": "warn",
    "no-var": "error"
  },
  ignorePatterns: ["dist", "node_modules", "*.d.ts", "release"]
};