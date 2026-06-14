# 门店端 H5/PWA 内测版设计

## 目标

生成第一版内测 APP，优先服务门店店员试用。当前不做 iOS、应用市场上架、会员营销或商品核价新功能，只把已有门店端能力包装成可安装、可分享、可部署的 H5/PWA 内测版本。

## 范围

本版只覆盖 `store-terminal`：

- 登录
- 门店工作台
- 快速开单
- 挂单/取单
- 库存查看
- 小程序订单接单/完成
- 分享收款
- 退款记录
- 销售日报

不包含：

- iOS TestFlight
- 安卓原生功能
- 应用市场上架
- 正式支付通道接入
- B「商品核价引擎」
- D「会员体系 + 营销」

## 实现方案

### PWA 能力

在 `store-terminal` 增加：

- `public/manifest.webmanifest`
- `public/icons/` 基础图标
- `public/sw.js`
- `src/register-sw.ts`
- `index.html` 中的移动端 meta、manifest、主题色

PWA 的显示模式使用 `standalone`，主题色使用 UI v2.0 主色 `#1677FF`。

### 环境配置

门店端读取 `VITE_API_BASE_URL`：

- 本地默认连接 `http://localhost:8080`
- 公测部署后连接 `https://api.<正式域名>`

新增示例文件：

- `store-terminal/.env.beta.example`

### 打包产物

新增脚本生成内测包：

- `scripts/build-store-beta.mjs`

脚本职责：

- 执行 `store-terminal` 构建
- 生成 `store-terminal-beta.zip`
- 输出部署说明

最终内测入口以 H5/PWA 为主：

- 部署到 `https://store.<正式域名>`
- 店员用手机浏览器打开后添加到桌面
- 后续如需 APK，再用 WebView 壳包装该地址

## 验收标准

- `npm run build` 通过
- `npm run test:ui` 通过
- `npm run test:store` 通过
- `store-terminal/dist/manifest.webmanifest` 存在
- `store-terminal/dist/sw.js` 存在
- `store-terminal-beta.zip` 可生成
- 手机浏览器打开后可添加到桌面

## 风险与处理

- 服务器和域名尚未完全可用：先保留 `.env.beta.example`，部署时再写真实 API 地址。
- PWA 离线能力不做复杂缓存：本版只缓存应用壳，不缓存业务接口数据，避免库存/订单数据陈旧。
- 安卓 APK 暂不生成原生包：先用 PWA 试用，确认稳定后再封装 APK。
