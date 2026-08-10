# 智享全链 移动端 App 打包指南

> 目标：把 `app-mobile`（uni-app）打成 Android APK（iOS 需 macOS + 开发者账号，另述）。
>
> 说明：uni-app CLI 的 `uni build -p app` 只生成 App 资源包，最终 APK 需用 **HBuilderX 云打包**（DCloud 服务器构建）或**离线打包**（Android Studio + 离线 SDK）。本项目推荐 HBuilderX 云打包。

## 一、当前已完成

- 已执行 `npm run build:app`，App 资源包生成于：
  `app-mobile/dist/build/app`（约 2.3MB，含 app-service.js / manifest.json / 页面资源）
- 构建产物已确认使用真实接口地址：
  - API：`https://api.onepan.cn`
  - AI：`https://m.onepan.cn/ai-api`
  - 无 `localhost:3016` / `zhixiang-chain` 残留

## 二、生成 APK（HBuilderX 云打包，推荐）

1. 安装 HBuilderX（https://www.dcloud.io/hbuilderx.html，Windows 版）。
2. 打开 HBuilderX → 文件 → 导入 → 从本地目录导入：选择 `app-mobile` 项目（或直接导入 `app-mobile/dist/build/app`）。
3. 生成 Android 签名证书（首次需要）：
   - HBuilderX 顶部菜单：发行 → 原生App-云打包 → 勾选 Android → 证书管理（或直接按提示生成）
   - 或使用任意 JDK 执行：
     ```bash
     keytool -genkeypair -alias zhixiang -keyalg RSA -keysize 2048 -validity 9125 \
       -keystore zhixiang-release.keystore \
       -dname "CN=智享全链, OU=智享全链, O=深圳市宝安区智享全链软件工作室, L=深圳, ST=广东, C=CN"
     ```
   - **务必备份 keystore 和密码**：丢失后将无法升级已发布的 App。
4. 选择打包平台 Android → 选择/上传 keystore → 云打包（需要登录 DCloud 账号，免费账号可打包，正式发布建议开通）。
5. 打包完成后下载 APK（通常 20~50MB，实际取决于原生插件）。

## 三、云打包前需处理的配置占位

| 配置项 | 现状 | 需要 |
|--------|------|------|
| Android 包名 | `com.zhixiang.app` | 已定，正式发布后不可改 |
| 微信支付 appid | `wx_appid_placeholder` | 需**微信开放平台**的移动应用 AppID（不是小程序的），并配置应用签名 |
| 推送 Push | 空 | 如需推送，开通 uni-push 并填对应配置 |

> 注意：App 内微信支付走的是「微信开放平台-移动应用」，与小程序 appid 不是同一个，需在开放平台单独创建应用并绑定打包签名。

## 四、iOS 打包（另需 macOS）

1. 需要 Apple 开发者账号（¥688/年）+ App ID + 推送证书（如需）。
2. 在 HBuilderX（macOS 版）→ 发行 → 原生App-云打包 → iOS → 上传描述文件/证书。
3. 如需上架 App Store，还需准备截图、隐私政策（已具备）等审核材料。

## 五、版本管理

- 版本号在 `app-mobile/src/manifest.json`：`versionName` / `versionCode`。
- 每次发版前递增 `versionCode`（Android 要求递增才能覆盖安装）。
