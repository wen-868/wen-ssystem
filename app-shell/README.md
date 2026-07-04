# 智享全链 - App 原生壳

## 项目说明

这是 `merchant-mobile`（Vue 3 + Vite 门店移动端）的 **HBuilder 5+App 壳项目**。

`www/` 目录下是已经构建好的前端产物，直接封装为 Android APK。

**HBuilder 项目类型：5+App（Webview 壳）**

---

## 架构层次

```
app-shell/
├── manifest.json           # HBuilder 原生配置（权限、启动、打包）
├── README.md
└── www/
    ├── splash.html          # 品牌启动页（Logo + 加载动画）
    ├── index.html           # 主应用入口
    ├── native-bridge.js     # 原生桥接层
    ├── config.json          # 系统配置（环境、API、功能开关）
    ├── cache-manifest.json  # 离线缓存清单
    └── assets/              # 前端构建产物
```

### 三层能力

| 层 | 文件 | 能力 |
|---|---|---|
| **本地缓存** | `native-bridge.js`（Storage/Cache 模块）<br>`cache-manifest.json` | plus.storage 持久化存储（不会被系统清理）<br>plus.cache 缓存管理（计算大小、清理）<br>离线资源清单和分级缓存策略 |
| **UI 设计** | `splash.html`<br>`native-bridge.js`（UI 模块）<br>`config.json`（ui 配置） | 品牌启动页（Logo + 渐变背景 + 加载动画）<br>原生 Toast / Loading / Dialog<br>状态栏动态控制（颜色、样式）<br>振动反馈 |
| **系统配置** | `config.json`<br>`native-bridge.js`（Config/Runtime/Updater 模块）<br>`manifest.json` | 多环境切换（dev/staging/production）<br>API 地址动态配置<br>版本管理和热更新（wgt）<br>功能开关（离线模式、生物识别、推送等）<br>设备信息、网络状态检测 |

---

## 原生桥接层 API

通过 `window.__NATIVE__` 访问，浏览器环境自动降级：

```js
// 持久化存储（比 localStorage 更可靠）
__NATIVE__.storage.set('key', { data: 1 })
__NATIVE__.storage.get('key', defaultValue)

// 原生 UI
__NATIVE__.ui.toast('操作成功')
__NATIVE__.ui.showLoading('加载中...')
__NATIVE__.ui.confirm('确认删除？').then(ok => ...)

// 系统配置
__NATIVE__.config.load().then(cfg => {
  console.log(cfg.apiBaseURL) // API 地址
  console.log(cfg.environment) // 当前环境
})

// 设备信息
__NATIVE__.runtime.getVersion()    // { name: '1.0.0', code: 100 }
__NATIVE__.runtime.getDeviceInfo() // 设备型号、UUID
__NATIVE__.network.getType()       // wifi | 4g | none
__NATIVE__.network.isOnline()      // true | false

// 缓存管理
__NATIVE__.cache.calculate() // 字节数
__NATIVE__.cache.clear()     // 清理

// 应用更新
__NATIVE__.updater.check('https://api.onepan.cn/api/app/version/check')
```

---

## 启动流程

1. App 启动 → `manifest.json` 指定 `launch_path: "splash.html"`
2. `splash.html` 显示品牌启动页（Logo + 动画 + 版本号）
3. 等待 `plusready` 事件 → 初始化原生桥接层 → 加载 `config.json`
4. 2.5 秒后渐出动画 → `window.location.replace('index.html')`
5. `index.html` 加载 Vue 应用（双轨：modern + legacy）

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
       ├── splash.html   ← 启动页
       ├── index.html    ← 主应用
       ├── native-bridge.js
       ├── config.json
       ├── cache-manifest.json
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
| 状态栏 | #1677FF |
| 启动页 | splash.html（品牌动画） |
| 环境 | production（config.json 可切换） |

---

## 环境切换

修改 `www/config.json` 中的 `environment` 字段：

```json
{
  "environment": "staging",
  "environments": {
    "dev":  { "apiBaseURL": "http://127.0.0.1:8080/api" },
    "staging": { "apiBaseURL": "https://staging-api.onepan.cn/api" },
    "production": { "apiBaseURL": "https://api.onepan.cn/api" }
  }
}
```

切换后重新打包即可。`native-bridge.js` 会自动读取当前环境的 `apiBaseURL`。

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