// S3-150-F1 取证用 vitest 配置（**不落库**，仅本会话沙箱取证）
//
// 为什么需要它：本沙箱禁止 node 创建带 `pipe` stdio 的子进程
// （`spawn EPERM`，见 docs/踩坑日志.md [143]），而 vitest 默认走
//   · 配置加载 = esbuild bundle 子进程
//   · TS 转换 = esbuild transform 子进程
// 两条路都会 EPERM。本配置用 `--configLoader native` 绕过配置打包，
// 并用 `esbuild: false` + TypeScript 编译器 API（同进程、不 spawn）
// 替代 esbuild 的 TS→JS 转译。其余设置逐条照抄 backend/vitest.config.ts。
import path from "node:path";
import ts from "../../node_modules/typescript/lib/typescript.js";

const BACKEND = path.resolve("D:/Users/ZXQL/wt-agents/issue-225/backend");

const sandboxTsTranspile = {
  name: "sandbox-ts-transpile",
  enforce: "pre",
  transform(code, id) {
    if (id.includes("node_modules")) return null;
    if (!/\.(ts|tsx|mts|cts)$/.test(id)) return null;
    const out = ts.transpileModule(code, {
      fileName: id,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        sourceMap: false,
      },
      reportDiagnostics: false,
    });
    return { code: out.outputText, map: null };
  },
};

export default {
  root: BACKEND,
  esbuild: false,
  plugins: [sandboxTsTranspile],
  resolve: {
    // 关掉 Vite 的 realpath 探测：其 Windows 分支会 exec("net use")，本沙箱
    // 拒绝带 pipe 的子进程（spawn EPERM）。关掉后走 fs.realpathSync，不起子进程。
    preserveSymlinks: true,
    extensions: [".ts", ".js"],
    alias: {
      "@services": path.resolve(BACKEND, "src/services"),
      "@shared": path.resolve(BACKEND, "src/shared"),
      "@middleware": path.resolve(BACKEND, "src/middleware"),
      "@controllers": path.resolve(BACKEND, "src/controllers"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    env: {
      NODE_ENV: "test",
      USE_MOCK_DB: "true",
      JWT_SECRET: "test-secret-key-for-vitest",
    },
    pool: "threads",
  },
};
