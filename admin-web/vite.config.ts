import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    // element-plus 按需导入：自动导入 ElMessage/ElMessageBox 等函数式组件
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    // element-plus 按需导入：自动注册 ElTable/ElForm 等UI组件
    Components({
      resolvers: [ElementPlusResolver()],
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vue 核心生态
          if (id.includes('node_modules/vue/') ||
              id.includes('node_modules/@vue/') ||
              id.includes('node_modules/vue-router/') ||
              id.includes('node_modules/pinia') ||
              id.includes('node_modules/pinia-plugin-persistedstate')) {
            return 'vue-vendor'
          }
          // ECharts 拆分：core+charts+components 合并（有循环依赖），zrender 单独
          if (id.includes('node_modules/zrender/')) {
            return 'zrender'
          }
          if (id.includes('node_modules/echarts/')) {
            return 'echarts'
          }
          // axios
          if (id.includes('node_modules/axios/')) {
            return 'axios'
          }
          // tiptap 富文本编辑器（体积小，约85KB，无需单独拆分）
          // element-plus 按需导入后各组件分散打包，不再整体合并
        }
      }
    }
  }
});
