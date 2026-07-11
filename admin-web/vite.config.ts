import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false,
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: false,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173
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
