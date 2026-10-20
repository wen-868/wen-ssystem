# H5 computed 值取证（QODER-17F1 · 新基线重做）

- 静态服务：`node _scratch/qoder-17f1/scratch-h5-server.js`（源码见 `raw/10-server-source.txt`），
  根 = `app-mobile/dist/build/h5`（本单 `build:h5` 产物），端口 **5181**，300s 自杀退出。
- 取数：browser-use MCP `navigate_page` → `http://127.0.0.1:5181/#/`，`evaluate_script` 读 computed。
- 路由：无 token ⇒ onLaunch reLaunch 到登录页 ⇒ 使用点 `.login-page`（`login.vue:326` `padding-top: var(--safe-top)`）在页。
- 浏览器：Electron/43（Chromium 150）in-app 浏览器，视口 532×559 @dpr 1.75。

## 读数汇总

| 测点 | 值 | 结论 |
| --- | --- | --- |
| 运行时 DOM 里 viewport meta 数 | `1` | 无第二份 viewport（防口径漂移） |
| 运行时 viewport meta content | `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` | **viewport-fit=cover 确实进了产物运行时**（与 `raw/06` 字符串直证一致） |
| `getComputedStyle(uni-page-body).getPropertyValue('--safe-top')` | **`0px`**（typeof string，可解析、非空串） | 变量定义生效；桌面浏览器 `env(safe-area-inset-top)` 恒解析 0px 属正常 |
| `getComputedStyle(documentElement).getPropertyValue('--safe-top')` | `''`（空） | 作用域在 `uni-page-body`（`page` 选择器的编译目标）而非 `:root`，与上一轮同态，本单未改作用域、非缺陷 |
| `uni-page-body` 首个子 `UNI-VIEW` 的 `--safe-top` | `0px` | 继承链正常，96 处使用点均可取值 |
| `.login-page`（使用点）`--safe-top` / `padding-top` | `0px` / `0px` | 使用点解析正常（桌面 0 ⇒ 无位移） |
| `CSS.supports('padding-top','env(safe-area-inset-top)')` | `true` | 环境支持 env() |
| 匹配规则（03） | `uni-page-body { … --safe-top: env(safe-area-inset-top); }` 来自产物 `assets/index-DpZdr1mN.css`；`.login-page[data-v-3ccac9dd] { padding-top: var(--safe-top); … }` 来自 `assets/login-BwfxU_Xk.css` | 定义一处、使用点引用，产物层叠链完整 |
| 活体自证（03）：运行时把 `--safe-top` 注成 `var(--safe-top)` | `0px` ⇒ **`''`（失效）** ⇒ 移除后回 `0px` | 证明**读数方法有鉴别力**（不是恒绿读数）；同时复核上一轮结论 |
| 运行时 viewport-fit 注入/移除（02） | 带 cover / 去掉 cover / 复原 三态 computed 全为 `0px`（`desktop_identical=true`） | **桌面无法鉴别 viewport-fit**：该键值只在 iOS 全屏 webview 决定 env 是否非零 ⇒ 真机效果**未验**，不以桌面读数冒充通过 |

## 截图

`take_screenshot` 本轮**成功产出**（上一轮报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE` 未产出）：
`screenshot-h5-login-desktop.png`（931×978，230KB，H5 产物登录页桌面视口渲染）。
说明：桌面 env=0，截图对 viewport-fit 无鉴别力，仅证"产物可正常渲染、页头未因本单改动位移"。

## 未验（不在本目录判定范围）

- iOS 真机 `env(safe-area-inset-top)` 在 viewport-fit=cover 下是否拿到非零：**未验**（无设备）。
- Android / 微信开发者工具 / App(webview `--status-bar-height`) 运行时：**未验**。
- 复现命令：见 `README.md` 末尾。
