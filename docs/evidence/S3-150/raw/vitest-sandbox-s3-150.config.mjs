// S3-150 沙箱内可跑 vitest 的配置（取证用，不落库）
//
// 来源与改动说明：
//   · 基线取自同目录 `vitest-sandbox.config.mjs`（**非本会话创建**，署名标注为 S3-150-F1，作对照留痕，未改动）；
//   · 本文件在其基础上**只加一行** `resolve.preserveSymlinks: true`：Vite 在 Windows 上会
//     `exec("net use")` 探测网络盘（vite/dist/node/chunks/dep-*.js 的 optimizeSafeRealPathSync），
//     而本沙箱禁止 node 创建带 pipe 的子进程（`spawn EPERM`，见 docs/踩坑日志.md[143]）⇒ 上一版仍在该处崩；
//     打开 preserveSymlinks 后 Vite 走 `fs.realpathSync` 而不 spawn。
//   · 其余（`esbuild: false` + TypeScript 编译器 API 同进程转译、--configLoader native、mock 环境变量）照抄基线。
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
  // Vite 的 vite:define 插件对含 `process.env` / `import.meta.env` 的文件会调 esbuild 的 transform
  // （单文件 transform 仍要 spawn 服务进程 ⇒ EPERM）。keepProcessEnv 让该类字面量原样保留 ⇒ 插件直接 return。
  keepProcessEnv: true,
  plugins: [sandboxTsTranspile],
  resolve: {
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
