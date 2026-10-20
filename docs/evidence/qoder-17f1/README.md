# QODER-17F1 证据目录（`index.html` 补 `viewport-fit=cover` + 常驻门禁重栈）

工作树 `D:\Users\ZXQL\wt-agents\QODER-17`｜分支 `fix/qoder-17f1-safe-top-viewport`｜代码基线 `dfeedbc0`（#368 合并后的 main）。
本轮**没有任何借入装置**：`app-mobile/vitest.config.ts`、`.eslintrc.cjs`、`scripts/*.mjs`、`scripts/gates-baseline.json`
都是 `dfeedbc0` 起的常驻文件，四道门一律 `cd app-mobile && npm run type-check|lint|test|check:contract` 原样跑（协议 §1）。
盘外 scratch 只放体积大的 eslint 全量 json 与注入脚本：`D:/Users/ZXQL/wt-agents/_scratch/qoder-17f1/`（不入库）。

> 旧目录 `docs/evidence/qoder-17/`（上一轮 QODER-17）**原样保留、未改写**；本轮读数另存新目录，两目录并存可对照。

## raw/ —— 各判据原始输出（含命令与 EXIT）

| 文件 | 内容 | 读数 |
| --- | --- | --- |
| 01-gates-before.txt | 改动落地前四门串行（常驻 `npm run`） | type-check EXIT=0（0=0）；lint error 20 / warning 12872 EXIT=0；**test 6 文件 / 59 用例** EXIT=0（基线仍 5/56，打印"请调高"）；contract EXIT=0 |
| 02-gates-after.txt | 改动落地后四门串行 | type-check EXIT=0（0=0）；lint error 20 / warning 12872 EXIT=0；**test 6 文件 / 60 用例**，基线 6/60 ⇒ EXIT=0；contract EXIT=0 |
| 03-lint-per-rule-snapshot.txt | eslint 全量 json 的逐规则计数（判据入口仍是 `npm run lint`，本文件只作逐规则取证） | files=187 / error=20 / warning=12872；`vue/html-indent=12299`、`no-console=225`、`html-closing-bracket-spacing=196`、`no-unused-vars=104`、`multiline-html-element-content-newline=47`、`html-closing-bracket-newline=1` ⇒ 与冻结基线**逐项相等**，errorsByFileRule 仍 13 对；PER-RULE-NOT-DEGRADED: OK |
| 04-index-html-viewport-source.txt | 源码 index.html 全文 + viewport 行 + SHA | 第 5 行 content 末尾追加 `, viewport-fit=cover`；其余 charset / 两个 apple-mobile-web-app meta / title / link / `#app` / `/src/main.js` **逐字未动**（git diff 该文件 1 行改）；sha256 `dd221de3…` |
| 05-build-h5.txt | `npm --workspace app-mobile run build:h5`（工作树根） | DONE Build complete. **BUILD_EXIT=0**（两条既有告警：uni 版本提示、hd-scan.svg 运行时解析，与本单无关） |
| 06-dist-h5-index-viewport.txt | **产物**里的 viewport 字符串（"配置进产物"直证） | `dist/build/h5/index.html:7` = `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`；`grep -c viewport-fit=cover` = **1**；产物 4 条 meta 与模板一致（对照上一轮 raw/09"产物无 viewport-fit"） |
| 07-dist-css-safetop-snippet.txt | 产物 CSS 的定义/使用点与条件编译剔除 | 定义唯一：`uni-page-body{…--safe-top: env(safe-area-inset-top)}`（index-DpZdr1mN.css）；产物 `var(--safe-top)` 使用点 **96** 处；`var(--status-bar-height)` 命中 **0**（APP-PLUS 覆盖被条件编译正确剔除，符合预期）；源码 `App.vue:57-61` 覆盖块仍在 |
| 08-safetop-usage-grep.txt | 源码使用点计数（本单零改动验证） | `grep -rn "var(--safe-top)" app-mobile/src` = **96 处 / 89 文件**，与旧目录 `qoder-17/raw/13`（负责人复核修后 96/89）**逐项一致，无差异需报备**；旧 `raw/08` 的 97/90 是含定义行的修前快照，口径已在旧 README 标注，本单不改写旧目录 |
| 10-server-source.txt | H5 computed 取证用的最小静态服务器源码（跑完 300s 自退，未入库） | 端口 5181，根 = `dist/build/h5`，SPA fallback |

> 编号 09 本轮未使用（不留空文件）；`anti/09-…note.txt` 是反测段的第一轮失败尝试记录，见下。

## anti/ —— 反测「红 → 复原 → 绿」

反测 1（卡 §三 点名，必须做）：删掉 `viewport-fit=cover` ⇒ 常驻 `npm run test` 红并点名④。

- `00-pre-sha256.txt`：注入前 index.html sha256 = `dd221de3…`（与 04 同一读数），并 `cp` 备份到工作树外 scratch。
- `01-strip-viewport-fit-red.txt`：scratch `.mjs`（latin1，命中数 ≠1 即 exit 9）删唯一 `, viewport-fit=cover` ⇒
  `npm run test` **TEST_EXIT=1**，`FAIL tests/safe-top-var.spec.ts > QODER-17F1 index.html viewport > ④ viewport meta 必须同时含
  width=device-width 与 viewport-fit=cover`，`Tests 1 failed | 59 passed (60)`；①②③ 与另 56 条全绿（红点精确打在④）。
- `02-restore-sha256.txt`：`cp` 复原（未用 `sed -i`、未用 Edit 删功能行）⇒ sha256 回到 `dd221de3…`，**SHA256-MATCH-OK 逐字节一致**；
  `git status --porcelain -- app-mobile/index.html` 空。
- `03-restore-green.txt`：复原后复跑 ⇒ **TEST_EXIT=0、6 文件 / 60 用例全过、基线 6/60**。
- `03a-restore-green-attempt1-flaky-timeout.txt`：**保留的第一次复跑原始记录**（不删除）：那一次撞到与本单无关的既有用例
  `tests/api-base-env.spec.ts:33` `Error: Test timed out in 5000ms`（同批串行连跑 4 次 vitest、机器高负载，Duration 66s/import 116s），
  红点不在本单目标断言上（safe-top 四条该次全绿）；干净复跑即 03。**如实登记，不粉饰。**

反测 2（协议建议补的更强一条）：把 `App.vue:54` 注回自引用 ⇒ 用例①红。

- `04-pre-sha256-appvue.txt`：sha256 `7b8d33bd…`（与上一轮 anti/00 同值 ⇒ src 两轮之间零漂移）。
- `05-inject-selfref-red.txt`：**TEST_EXIT=1**，`× ① 不得出现自引用`、`× ② 默认分支必须含 env(...)` 两条红（2 failed | 58 passed），
  且 **④ 在同一次运行里保持绿** ⇒ ①②与④两组断言互不粘连，反测可精确打中。
- `06-restore-sha256-appvue.txt`：`cp` 复原 ⇒ `7b8d33bd…` **一致**；`git status --porcelain -- app-mobile/src` 空。
- `07-restore-green.txt`：复跑 **TEST_EXIT=0、6/60 全过**。

过程记录：

- `08-run-console.txt`：两条反测同一串行批次的完整逐步骤控制台输出（含每步命令与读数）。
- `09-aborted-first-attempt-path-mismatch.note.txt`：首轮脚本 `/d/...` MSYS 路径 node 不识别 ⇒ `.mjs` MODULE_NOT_FOUND ⇒
  脚本内置保护（命中数≠1 / 注入失败即 `cp` 复原并退出）**未触文件**，事后 sha256 与 `git status` 证实完好；改用 `D:/...` 后重跑。

## browser/ —— H5 computed 取证（AGENTS.md R8.1，新基线重做）

见 `browser/README.md` 读数表。原始返回：`01-computed-values.txt`（`uni-page-body` 上 `--safe-top` = **0px 可解析非空**、
运行时 viewport meta 含 `viewport-fit=cover`、`.login-page` padding-top 使用点 0px）、
`02-live-viewport-fit-toggle-desktop-no-delta.txt`（运行时摘掉/复原 viewport-fit，桌面 computed 三态**全为 0px**，
`desktop_identical=true` ⇒ 桌面无法鉴别该项，真机影响**未验**）、
`03-matched-rule-and-method-selfcheck.txt`（产物层叠规则：定义唯一 + `.login-page` 使用点；
活体自证：注自引用 ⇒ 空串、移除 ⇒ 0px ⇒ 读数方法有鉴别力）。
`screenshot-h5-login-desktop.png`：本轮 `take_screenshot` **成功产出**（上一轮报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE` 未产出），
931×978 桌面视口登录页；对 viewport-fit 无鉴别力，只证产物渲染正常、页头未位移。

## 真机

iOS/Android 真机、微信开发者工具、App 端 `--status-bar-height` 运行时注入：**未验（无设备）**，未写通过；复现命令见回传卡 §九。
