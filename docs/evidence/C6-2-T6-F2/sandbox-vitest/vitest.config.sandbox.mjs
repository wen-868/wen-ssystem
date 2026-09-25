/**
 * 沙箱内可用的 vitest 配置（C6-2-T6-F2）
 *
 * 背景：本沙箱禁止 node 创建子进程（`spawnSync(process.execPath,...)` ⇒ EPERM），
 * `npx vitest` 在加载 vitest.config.ts 时即 `Error: spawn EPERM`（esbuild service 起不来）。
 * 复用 C6-1A 留在仓内的壳（`docs/evidence/C6-1A/sandbox-vitest/`：esbuild 假实现 + 注册钩子），
 * 配合本配置即可在沙箱内真实执行测试文件。**凌舟本机/CI 请用标准命令 `npm --workspace backend test`。**
 *
 * 与 S3-110 版配置的唯一差别：`BASE` 指向**本工作树**（issue-128）的 backend，
 * 以便别名（@services/@shared/@middleware/@controllers）在本地解析到本工作树的源码。
 *
 * 用法（在 backend 目录）：
 *   $hook = "…/docs/evidence/C6-1A/sandbox-vitest"
 *   $env:NODE_OPTIONS = "--import file:///" + ($hook -replace '\\','/') + "/register-hook.mjs"
 *   npx vitest run --configLoader native --config ../docs/evidence/C6-2-T6-F2/sandbox-vitest/vitest.config.sandbox.mjs --root . --pool=threads
 */
import path from "node:path";

const BASE = "D:/Users/ZXQL/wt-agents/issue-128/backend";

export default {
  root: BASE,
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@services": path.resolve(BASE, "src/services"),
      "@shared": path.resolve(BASE, "src/shared"),
      "@middleware": path.resolve(BASE, "src/middleware"),
      "@controllers": path.resolve(BASE, "src/controllers")
    }
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    env: { NODE_ENV: "test", USE_MOCK_DB: "true", JWT_SECRET: "test-secret-key-for-vitest" }
  }
};
