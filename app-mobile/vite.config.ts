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
})
