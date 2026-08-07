import { createSSRApp } from 'vue'
import './styles/app.scss'

// Taro 入口约定：默认导出 Vue app 实例（H5/小程序运行时均按此初始化）
const app = createSSRApp({})

export default app
