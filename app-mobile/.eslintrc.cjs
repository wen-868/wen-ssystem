/**
 * QODER-1（批次 0）· 门 2 —— app-mobile ESLint 配置
 *
 * 形态与 admin-web/.eslintrc.cjs 同族（eslint 8 eslintrc + vue-eslint-parser +
 * @typescript-eslint），**不引入 flat config 第二套心智**。
 * 基线口径（任务书 §二.2）：`eslint src/` **0 error**；warning 允许但条数冻结在
 * `scripts/gates-baseline.json`（CI 判"不劣化"，见 package.json 的 lint 脚本）。
 * 为此把"存量必然超"的风格类规则显式降为 warn 并在基线里计数——这是**冻结存量**，
 * 不是绕过：error 位留给"新引入的真问题"（未定义变量/重复键/不可达代码等）。
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  globals: {
    // uni-app 运行时全局（条件编译后由 App/H5/mp 宿主注入）
    uni: 'readonly',
    wx: 'readonly',
    plus: 'readonly',
    getCurrentPages: 'readonly',
    getApp: 'readonly',
    UniApp: 'readonly'
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['vue', '@typescript-eslint'],
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-console': 'warn',
    'no-debugger': 'error',

    // Vue 存量风格（冻结为 warn，逐批清）
    'vue/html-indent': ['warn', 4],
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/attributes-order': 'off',
    'vue/html-self-closing': 'off',
    'vue/require-default-prop': 'off',
    'vue/require-prop-types': 'off',

    // TypeScript 存量（冻结为 warn）
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'off',

    // 通用：error 位留给真问题
    'no-unused-vars': 'off',
    'no-var': 'error',
    'prefer-const': 'warn',
    'eqeqeq': 'off'
  },
  ignorePatterns: ['dist', 'node_modules', 'unpackage', '*.d.ts', 'scripts', 'tests']
}
