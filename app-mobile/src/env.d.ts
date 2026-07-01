/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@dcloudio/uni-app' {
  export * from '@dcloudio/uni-app'
}

declare module '@dcloudio/uni-ui' {
  export * from '@dcloudio/uni-ui'
}