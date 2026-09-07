/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/* R96-04: 微信小程序全局对象。项目仅依赖 @dcloudio/types（无 miniprogram-api-typings），
   MP-WEIXIN 条件编译块内用到 wx.env.USER_DATA_PATH 等成员时 vue-tsc 会报 TS2304。
   该声明仅在类型层补位，条件编译保证 wx 引用只存在于小程序产物中。 */
declare const wx: any

/* R96-03: 原此处有 declare module '@dcloudio/uni-app' { export * from '@dcloudio/uni-app' }。
   该自引用 ambient 声明会遮蔽官方类型（循环解析后模块在 TS 眼里没有任何导出），
   导致全部生命周期钩子与 onShareAppMessage 报 TS2305「no exported member」。
   官方 node_modules/@dcloudio/uni-app/dist/uni-app.d.ts 的类型完整可解析，直接删除即可。 */

declare module '@dcloudio/uni-ui' {
  export * from '@dcloudio/uni-ui'
}