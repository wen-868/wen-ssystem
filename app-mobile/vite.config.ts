import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'

/** 1x1 透明GIF（base64），替代 uni-h5 默认的 shadow-grey CDN 资源，避免控制台出现 CDN 请求失败 */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const SHADOW_CDN_RE = /https:\/\/cdn\.dcloud\.net\.cn\/img\/shadow-grey\.png/g

// API 代理目标：默认本地后端 8080；本地预览连服务器时可设 VITE_PROXY_TARGET 覆盖
const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:8080'

export default defineConfig({
  // dev 环境 API 代理：H5 本地走查时 /api 转发到后端 8080（生产由 nginx 处理）
  server: {
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    // 替换 @dcloudio/uni-h5 运行时中硬编码的 CDN shadow-grey.png 为本地透明像素
    {
      name: 'ache:replace-shadow-grey-cdn',
      enforce: 'pre',
      transform(code: string, id: string) {
        if (!SHADOW_CDN_RE.test(code)) return null
        return {
          code: code.replace(SHADOW_CDN_RE, TRANSPARENT_PIXEL),
          map: null,
        }
      },
    },
    uni(),
    // urlCheck 环境化（R78-02）：微信小程序 dev 构建保持 false（manifest.json 默认值，
    // 便于本地调试非 https 域名）；生产构建强制 true（避免 urlCheck:false 上架审核被拒）
    {
      name: 'ache:mp-weixin-prod-urlcheck',
      apply: 'build',
      generateBundle(_options, bundle) {
        if (process.env.UNI_PLATFORM !== 'mp-weixin') return
        if (process.env.NODE_ENV !== 'production') return
        const asset = bundle['project.config.json']
        if (!asset || asset.type !== 'asset') return
        const cfg = JSON.parse(asset.source.toString())
        cfg.setting = cfg.setting || {}
        cfg.setting.urlCheck = true
        asset.source = JSON.stringify(cfg, null, 2)
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // R96-01: 静默 Dart Sass 的 legacy-js-api 弃用警告。
        // 根因：@dcloudio/uni-cli-shared 的 CSS 插件（dist/vite/plugins/vitejs/plugins/css.js）
        // 内部调用的是 sass.render() —— Dart Sass 旧版 JS API，1.79+ 起弃用、2.0.0 将移除。
        // 该调用位于 node_modules 三方框架代码中，本项目无法直接修改；
        // 升级 @dcloudio/* 大版本风险过高（会牵动 113 个页面的编译行为），
        // 因此采用官方推荐的 silenceDeprecations 选项在编译期静默该框架级警告。
        // 影响范围：仅抑制日志输出，不改变任何编译行为与产物；待 uni-app 官方改用 modern API 后可移除。
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
})
