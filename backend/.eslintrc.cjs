/**
 * 后端 ESLint 配置
 * 适用于 Node.js + Express.js + TypeScript 项目
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    // 控制台输出
    "no-console": ["warn", { allow: ["warn", "error"] }],

    // 调试
    "no-debugger": "error",

    // TypeScript 规则
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-non-null-assertion": "off",
    // declare global { namespace Express } 是 TS 类型增强的标准模式
    "@typescript-eslint/no-namespace": "off",

    // 通用规则
    "no-var": "error",
    "prefer-const": "warn",
    "no-unused-vars": "off",
    // 圈复杂度基线（验收标准目标 ≤8，现状有历史超限函数；先按 15 门禁可观测，
    // 逐轮下调，见 docs/顶级商业软件完成标准明细-智享系统验收.md 改进路线图）
    "complexity": ["warn", { "max": 15 }],

    // 路由文件规范：禁止在路由文件中使用 try/catch（应在 controller 中处理）
    // 通过目录匹配规则实现，见 overrides
  },
  overrides: [
    {
      // 路由文件：只允许路由注册逻辑，禁止内联业务逻辑
      files: ["src/routes/**/*.ts"],
      rules: {
        // 禁止在路由文件中直接使用 res.json（应在 controller 中）
        // 此规则通过代码审查保障，ESLint 自定义规则过于复杂
        "no-console": "off",
      },
    },
    {
      // 测试文件：放宽规则
      files: ["src/__tests__/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "node_modules", "coverage", "*.js", "*.cjs", "*.d.ts"],
};
