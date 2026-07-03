# 智享全链 - App 原生壳

## 项目说明

这是 `merchant-mobile`（Vue 3 + Vite 门店移动端）的 **Cordova 原生 App 壳项目**。

`www/` 目录下是已经构建好的前端产物（`npm run build` 生成），直接封装为 Android APK。

---

## 快速打包（两种方式）

### 方式一：HBuilder 云打包（最简单，推荐）

1. 用 HBuilder 打开本目录（`app-shell`）
2. 确保左侧项目树能看到 `www/index.html`
3. 菜单 → **发行 → 原生 App-云打包**
4. 选择 **Android（apk包）**
5. 包名已配置为 `uni.app.ZHIXIANG`，应用名"智享全链"
6. 点击打包，等待云端生成 APK

### 方式二：本地 Cordova 打包（需要环境）

前置要求：Node.js、Java JDK 17、Android SDK、Gradle

```bash
# 进入壳项目
cd app-shell

# 安装 Cordova CLI
npm install -g cordova

# 添加 Android 平台
cordova platform add android

# 调试包
cordova build android

# 正式签名包
cordova build android --release
```

---

## 配置信息

| 项 | 值 |
|---|---|
| 应用名称 | 智享全链 |
| 包名 | uni.app.ZHIXIANG |
| 版本 | 1.0.0 |
| 最低 Android 版本 | API 24 (Android 7.0) |
| 目标 Android 版本 | API 34 (Android 14) |
| 屏幕方向 | 竖屏 |
| 状态栏颜色 | #1989fa |

---

## 更新前端代码后重新打包

如果 `merchant-mobile` 源码有修改：

```bash
cd merchant-mobile
npm install
npm run build

# 复制新构建产物到壳项目
cp -r dist/* ../app-shell/www/

# 然后重新执行上面的打包步骤
```
