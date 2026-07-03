# 智享全链 - App 原生壳

## 项目说明

这是 `merchant-mobile`（Vue 3 + Vite 门店移动端）的 **HBuilder 5+App 壳项目**。

`www/` 目录下是已经构建好的前端产物，直接封装为 Android APK。

**HBuilder 项目类型：5+App（Webview 壳）**

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
npm install && npm run build
cp -r dist/* ../app-shell/www/
cd ../app-shell
# 然后在 HBuilder 中重新云打包
```