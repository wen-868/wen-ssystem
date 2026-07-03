# 智享全链 - App 原生壳

## 项目说明

这是 `merchant-mobile`（Vue 3 + Vite 门店移动端）的 **HBuilder 5+App 壳项目**。

`www/` 目录下是已经构建好的前端产物，直接封装为 Android APK。

**HBuilder 项目类型：5+App（Webview 壳）**

---

## 为什么之前白屏

Vite 默认构建输出 `<script type="module" crossorigin>`。在 HBuilder 5+App WebView 中，HTML 从 `file://` 协议加载，ES Module 受 CORS 限制，`file://` 没有 CORS 响应头，导致 JS 文件加载失败，页面白屏。

**解决方案**：引入 `@vitejs/plugin-legacy`，同时生成 `nomodule` 的 legacy 版本（通过 SystemJS 加载），WebView 会自动使用 legacy 脚本。

---

## HBuilder 云打包步骤

1. HBuilder 菜单 → **文件 → 打开目录**，选择 `app-shell` 文件夹
2. 项目树结构：
   ```
   app-shell
   ├── manifest.json    ← HBuilder 配置文件
   ├── README.md
   └── www
       ├── index.html
       └── assets
   ```
3. 菜单 → **发行 → 原生 App-云打包**
4. 包名 `uni.app.ZHIXIANG`，应用名"智享全链"
5. 点击打包，等待云端生成 APK

---

## 配置信息

| 项 | 值 |
|---|---|
| 应用名称 | 智享全链 |
| 包名 | uni.app.ZHIXIANG |
| 版本 | 1.0.0 |
| 最低 Android | API 24 (Android 7.0) |
| 目标 Android | API 34 (Android 14) |
| 屏幕方向 | 竖屏 |
| 状态栏 | #1989fa |

---

## 更新前端代码后重新打包

```bash
cd merchant-mobile
npm install
npm run build
cp -r dist/* ../app-shell/www/
cd ../app-shell
# 然后在 HBuilder 中重新云打包
```

## 打包产物说明

构建后 `www/` 包含两类文件：
- **legacy 版本**（`*-legacy-*.js`）：通过 `<script nomodule>` 加载，使用 SystemJS，适用于 WebView `file://` 协议
- **现代版本**（`index-*.js`, `vant-*.js`, `vue-vendor-*.js`）：通过 `<script type="module">` 加载，适用于浏览器 HTTP 访问

HBuilder 5+App WebView 会自动使用 legacy 版本。