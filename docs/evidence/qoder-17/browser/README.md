# QODER-17 · browser/ —— H5 computed 值取证（任务书 §三 点名 + AGENTS.md R8.1）

环境：本地静态服务 `node -e` 最小 http server（源码见 raw/11-server-source.txt），
指向 `app-mobile/dist/build/h5`，端口 5179；browser-use MCP（evaluate_script / navigate_page）。
页面路由：无 token ⇒ onLaunch reLaunch 到登录页（`#/`），`.login-page` 的
`padding-top: var(--safe-top)` 即真实使用点（login.vue:326）。

## 读数（原始输出 01-computed-values.txt / 02-live-cyclic-contrast.txt / 03-matched-rule.txt）

| 测点 | 值 | 结论 |
| --- | --- | --- |
| `getComputedStyle(uni-page-body).getPropertyValue('--safe-top')` | `0px` | **可解析、非空串**（桌面浏览器 `env(safe-area-inset-top)` 恒为 0px，属正常） |
| `getComputedStyle(document.documentElement).getPropertyValue('--safe-top')` | `''`（空） | **作用域为 `uni-page-body` 而非 :root**——`page` 选择器编译产物即 `uni-page-body{...}`（uni-app 固有行为，本单未改变作用域）；子元素继承后可读到 `0px` |
| `uni-page-body` 内第一个 `div` 的 `--safe-top` | `0px` | 继承链正常，各页面 `var(--safe-top)` 使用点可取到值 |
| `.login-page` 实测 `padding-top` | `0px` | 使用点解析正常 |
| 现场反证（02）：运行时注入 `--safe-top: var(--safe-top)` | `''`（失效）⇒ 移除后回 `0px` | **computed 值坐实原自引用即无效**（cyclic ⇒ 空串），修复后 `0px` 可解析——R8.1 层叠问题以 computed 值定论 |

## 截图

`take_screenshot` 两次（png / jpeg）均报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`
（in-app 浏览器无可见表面，visibilityState=hidden；evaluate_script/navigate_page 不受影响）。
⇒ **截图未产出**，见 screenshot-blocked.note.txt；computed 读数不受影响。
