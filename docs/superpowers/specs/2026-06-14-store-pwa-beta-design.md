# 双端内测包设计

## 目标

生成第一版内测包，覆盖门店端和 C 端移动端。门店端以 H5/PWA 形式交付，C 端移动端以微信小程序体验版准备包形式交付。当前不做 iOS、应用市场上架、会员营销或商品核价新功能，只把已有能力包装成可安装、可分享、可部署、可提交体验版的内测版本。

## 范围

本版覆盖两端。

### 门店端 `store-terminal`

- 登录
- 门店工作台
- 快速开单
- 挂单/取单
- 库存查看
- 小程序订单接单/完成
- 分享收款
- 退款记录
- 销售日报

### C 端移动端 `miniapp`

- 首页商品浏览
- 下单
- 订单详情
- 分享收款页
- 支付结果页
- 我的页面
- 内测 API 地址配置
- 微信开发者工具可导入的体验版准备包

不包含：

- iOS TestFlight
- 安卓原生功能
- 应用市场上架
- 正式支付通道接入
- B「商品核价引擎」
- D「会员体系 + 营销」

## 实现方案

### 门店端 PWA 能力

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

小程序读取 `miniapp/app.js` 中的 `globalData.apiBase`：

- 本地默认连接 `http://localhost:8080/api`
- 公测部署后连接 `https://api.<正式域名>/api`

新增示例文件：

- `miniapp/app.config.beta.example.js`

### 打包产物

新增脚本生成内测包：

- `scripts/build-store-beta.mjs`
- `scripts/build-mobile-beta.mjs`

门店端脚本职责：

- 执行 `store-terminal` 构建
- 生成 `store-terminal-beta.zip`
- 输出部署说明

移动端脚本职责：

- 校验 `miniapp/app.js` 中存在 `globalData.apiBase`
- 复制小程序源码到临时目录
- 生成 `miniapp-beta.zip`
- 输出微信开发者工具导入和体验版上传说明

最终内测入口以 H5/PWA 为主：

- 部署到 `https://store.<正式域名>`
- 店员用手机浏览器打开后添加到桌面
- 后续如需 APK，再用 WebView 壳包装该地址

C 端移动端以内测小程序为主：

- 微信开发者工具导入 `miniapp` 或解压 `miniapp-beta.zip`
- 替换真实小程序 `appid`
- 配置合法请求域名 `https://api.<正式域名>`
- 上传体验版并添加体验成员

## 验收标准

- `npm run build` 通过
- `npm run test:ui` 通过
- `npm run test:store` 通过
- `store-terminal/dist/manifest.webmanifest` 存在
- `store-terminal/dist/sw.js` 存在
- `store-terminal-beta.zip` 可生成
- `miniapp-beta.zip` 可生成
- `miniapp/app.config.beta.example.js` 存在
- 手机浏览器打开后可添加到桌面
- 微信开发者工具可导入小程序项目

## 风险与处理

- 服务器和域名尚未完全可用：先保留 `.env.beta.example`，部署时再写真实 API 地址。
- 小程序真实 appid 尚未确定：继续保留 `touristappid`，内测上传前由项目负责人替换为真实 appid。
- 小程序合法请求域名依赖 HTTPS：等域名和证书完成后再上传体验版。
- PWA 离线能力不做复杂缓存：本版只缓存应用壳，不缓存业务接口数据，避免库存/订单数据陈旧。
- 安卓 APK 暂不生成原生包：先用 PWA 试用，确认稳定后再封装 APK。
