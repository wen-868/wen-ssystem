import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'

/** 1x1 透明GIF（base64），替代 uni-h5 默认的 shadow-grey CDN 资源，避免控制台出现 CDN 请求失败 */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const SHADOW_CDN_RE = /https:\/\/cdn\.dcloud\.net\.cn\/img\/shadow-grey\.png/g

export default defineConfig({
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
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})