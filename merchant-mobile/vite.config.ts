import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    legacy({
      // 生成非 module 脚本，解决 HBuilder 5+App WebView 从 file://
      // 加载时 type="module" 因 CORS 策略失败导致白屏的问题
      targets: ['Android >= 7', 'iOS >= 12'],
      // 同时输出现代 module 版本和 legacy nomodule 版本
      // WebView 会使用 nomodule 版本（普通 script），避免 file:// CORS 问题
      renderLegacyChunks: true,
      modernPolyfills: false,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    // 拆出 vendor 库，增大打包体积同时优化缓存
    rollupOptions: {
      output: {
        manualChunks: {
          'vant': ['vant'],
          'vue-vendor': ['vue'],
        }
      }
    },
    // 确保资源路径正确
    assetsInlineLimit: 4096,
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
})