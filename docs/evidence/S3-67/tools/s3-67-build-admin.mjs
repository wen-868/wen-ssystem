/**
 * S3-67 取证环境辅助：用**当前源码**现场构建 admin-web（不依赖 esbuild 原生二进制）。
 *
 * 为什么需要它（环境限制，非项目问题）：
 *   本沙箱**禁止 node 创建带管道的子进程**（`spawn` 带 `stdio:'pipe'` ⇒ EPERM，实测），
 *   而 `vite` / `tsx` / `playwright` 默认都要 spawn 子进程（esbuild 二进制 / 浏览器），
 *   因此 `vite build`、`vite dev`、`tsx`、`playwright.launch()` 在本环境全部不可用。
 *   ⇒ 本脚本用 rollup（纯 JS）+ TypeScript 编译器 API（纯 JS）替代 esbuild 的**转译**职责，
 *     插件与解析器（plugin-vue / unplugin-auto-import / unplugin-vue-components + ElementPlusResolver）
 *     与项目 `admin-web/vite.config.ts` **逐项对齐**（含 ZxElTable 全局替换），保证渲染结果与正常构建一致。
 *
 * 与项目配置的对齐点（逐条核对）：
 *   - 插件：vue() + AutoImport(ElementPlusResolver) + Components(ElTable→ZxElTable, ElementPlusResolver)
 *   - alias：@ → admin-web/src
 *   - base："/"；VITE_API_BASE="/api"（与 CI/本机取证口径一致：同源 /api → 代理到 mock 后端 8081）
 *   - 差异（仅构建产物形态，不影响计算样式）：minify/cssMinify 关闭（便于人工核对产物中的 token 值）、
 *     manualChunks 不启用（分块策略与样式无关）
 *
 * 用法：node docs/evidence/S3-67/tools/s3-67-build-admin.mjs
 *      产物目录默认 %TEMP%\s3-67-admin-dist（可用环境变量 S3_67_DIST_OUT 覆盖）
 */
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import cp from "node:child_process";
import ts from "typescript";

// ─────────────────────────────────────────────────────────────────────────────
// 沙箱适配（只影响本进程的**子进程探测**，不改变任何构建/渲染行为）：
//   vite 在 Windows 上会执行 `net use` 探测网络盘（child_process.exec ⇒ 需要管道 ⇒ 本沙箱 EPERM）。
//   这里把该探测降级为"探测失败"（vite 的 fallback 就是不启用 realpath 缓存，属安全降级）。
// ─────────────────────────────────────────────────────────────────────────────
const origExec = cp.exec;
const isNetUseProbe = (cmd) => /^\s*net\s+use\b/i.test(String(cmd));
cp.exec = function patchedExec(cmd, opts, cb) {
  if (isNetUseProbe(cmd)) {
    const callback = typeof opts === "function" ? opts : cb;
    const err = new Error("EPERM（沙箱禁止带管道子进程）：已跳过 net use 探测");
    err.code = "EPERM";
    if (typeof callback === "function") queueMicrotask(() => callback(err, "", ""));
    return { on() { return this; }, once() { return this; }, kill() {}, pid: 0 };
  }
  return origExec.apply(this, arguments);
};

// 动态导入：确保上面的补丁在 vite 加载前生效（静态 import 会被提升）
const { build } = await import("vite");
const vue = (await import("@vitejs/plugin-vue")).default;
const AutoImport = (await import("unplugin-auto-import/vite")).default;
const Components = (await import("unplugin-vue-components/vite")).default;
const { ElementPlusResolver } = await import("unplugin-vue-components/resolvers");

const here = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(here, "..", "..", "..", "..");
const ROOT = path.join(WT, "admin-web");
const OUT = process.env.S3_67_DIST_OUT || path.join(os.tmpdir(), "s3-67-admin-dist");

/** 用 TypeScript 编译器 API 转译 TS / SFC 的 lang="ts" 脚本块（替代 vite:esbuild） */
function tsTranspile() {
  const isTsFile = (file) => /\.(ts|tsx|mts)$/.test(file);
  const isVueTsScript = (id) => id.includes(".vue") && /[?&]lang\.ts\b/.test(id);
  return {
    name: "s3-67-ts-transpile",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0];
      if (!isTsFile(file) && !isVueTsScript(id)) return null;
      const out = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.Preserve,
          esModuleInterop: true,
          sourceMap: true,
          inlineSources: true,
          isolatedModules: true,
          experimentalDecorators: true,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
        },
      });
      return { code: out.outputText, map: null };
    },
  };
}

process.env.VITE_API_BASE = process.env.VITE_API_BASE || "/api";

await build({
  root: ROOT,
  configFile: false,
  base: "/",
  logLevel: "info",
  esbuild: false,
  plugins: [
    tsTranspile(),
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()], dts: false }),
    Components({
      resolvers: [
        (name) =>
          name === "ElTable"
            ? { name: "default", from: "@/components/zx/ZxElTable.vue", as: "ElTable" }
            : undefined,
        ElementPlusResolver(),
      ],
      dts: false,
    }),
  ],
  resolve: { alias: { "@": path.join(ROOT, "src") } },
  define: {
    "import.meta.env.VITE_API_BASE": JSON.stringify(process.env.VITE_API_BASE),
  },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
    target: "esnext",
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 100000,
  },
});

console.log("[s3-67] admin-web 现场构建完成 → " + OUT);
