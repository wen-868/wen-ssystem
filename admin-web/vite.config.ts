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
    // 本地预览临时代理：对接线上 API（验证后还原）
    proxy: {
      "/api": {
        target: "https://api.onepan.cn",
        changeOrigin: true,
        secure: false
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
