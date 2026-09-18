import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  // Electron 桌面版通过 file:// 加载，必须使用相对路径；Web 部署保持根路径
  base: process.env.ELECTRON_BUILD === "1" ? "./" : "/",
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false,
    }),
    Components({
      resolvers: [
        // 全局表格增强：所有 <el-table> 自动走 ZxElTable（列宽/列序拖拽+持久化，强制 border）
        (name: string) =>
          name === "ElTable"
            ? { name: "default", from: "@/components/zx/ZxElTable.vue", as: "ElTable" }
            : undefined,
        ElementPlusResolver(),
      ],
      dts: false,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
    // ─────────────────────────────────────────────────────────────
    // S3-59.1 密闭性（凌舟 2026-09-19 派单 A-1）
    //   旧状：target 硬编码生产域名 + secure:false。CI 注入 VITE_API_BASE=/api 后，
    //   那个 USE_MOCK_DB=true 的 mock 后端形同虚设 —— job 时间窗内在生产 nginx
    //   access.log 留下 751 条访问（凌舟 2026-09-19 取证）。密闭性被彻底破坏。
    //
    //   🔴 修法（fail-safe）：**默认值只能是 127.0.0.1:8080**。
    //      任何"忘了配"的路径都不可能碰到生产；要连远端必须**显式**给值。
    //      本地如确需临时代理到远端环境，在 admin-web/.env.local（已被 .gitignore 忽略）
    //      写入 VITE_API_PROXY_TARGET=<远端地址> —— 值不入库，这正是本单要消除的东西。
    //   🔴 TLS 校验默认开启（secure 默认 true）；关校验须显式 VITE_API_PROXY_SECURE=false。
    // ─────────────────────────────────────────────────────────────
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080",
        changeOrigin: true,
        secure: process.env.VITE_API_PROXY_SECURE !== "false"
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 500,
    cache: true,
    minify: "esbuild",
    cssMinify: true,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue/') ||
              id.includes('node_modules/@vue/') ||
              id.includes('node_modules/vue-router/') ||
              id.includes('node_modules/pinia') ||
              id.includes('node_modules/pinia-plugin-persistedstate')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules/zrender/')) {
            return 'zrender'
          }
          if (id.includes('node_modules/echarts/')) {
            return 'echarts'
          }
          if (id.includes('node_modules/axios/')) {
            return 'axios'
          }
        }
      }
    }
  }
});
