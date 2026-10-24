【汇报 MOBILE-28F1】微信 WXSS 通配选择器阻断修复
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-24
执行通道：WorkBuddy（本卡新开窗口）

## 交付物

| # | 交付物 | 文件路径 | 提交哈希 |
|:--|:--|:--|:--|
| 1 | 三个规则块用样式级 `/* #ifndef MP-WEIXIN */ … /* #endif */` 隔离（H5/App 行为原样保留，**未删规则**）：全局 box-sizing、全局 reduced-motion、create-sale 页级 reduced-motion | `app-mobile/src/App.vue:69-75`、`app-mobile/src/App.vue:119-129`、`app-mobile/src/pages/sales/create-sale.vue:2472-2482` | `fde85d24` |
| 2 | 静态守卫（卡 §二.3）：MP 产物/源码不得出现未隔离的 `*` 通配 prelude；三模式 `--src`（默认）/ `--dist <目录>` / `--self-test` | `app-mobile/scripts/guard-mp-style-selectors.mjs` | `fde85d24` |
| 3 | 控制装置（正对照 + H5 保留 + 源码隔离自证，可复跑） | `docs/evidence/mobile-28f1/anti/20-positive-control-and-h5-preservation.mjs` | `fde85d24` |
| 4 | 证据包（修复前/后各 2 组、三端构建、门禁、CLI 探测）+ 索引 | `docs/evidence/mobile-28f1/README.md`、`docs/evidence/mobile-28f1/raw/{10,11,20,21,22,23,24,25,26,27,28,29}-*.txt` | `fde85d24` |

工作树 `D:\Users\ZXQL\wt-agents\MOBILE-28F1`｜分支 `mobile/MOBILE-28F1-mp-star-selectors`｜基线 `e257825f`（已验收 29F3 尖端，**未从旧 QODER-28 `b66940d7` 起跑**）。
改动面统计：`17 files changed, 621 insertions(+), 3 deletions(-)`；源码净改动仅 `+15 / −3`（全部是注释与包裹标记，规则本体一字未动）。

手法选择：卡 §二.1 的样式级条件编译**在仓内已有生效先例**——`App.vue:58-62` 的 `/* #ifdef APP-PLUS */` 与 `App.vue:11-16` 的 `// #ifndef MP-WEIXIN`（其注释自述"口径与 `components/app-tab-bar.vue` 保持一致：`#ifndef MP-WEIXIN`，不是只盖 APP-PLUS"）⇒ 位置受支持，**无需退到 §二.2 的 class 级等价方案**。

## 证据（可复跑）

以下命令均在 `D:\Users\ZXQL\wt-agents\MOBILE-28F1\app-mobile`（除注明外）执行。

1. **修复前基线** `node scripts/guard-mp-style-selectors.mjs --src` ⇒ `raw/10-before-src-scan.txt`
   `命中 3 处 / 未隔离 3 处`，逐条 `App.vue:67`、`App.vue:114`、`pages/sales/create-sale.vue:2471`，`MP_STAR_GUARD_SRC_FAIL` / EXIT=1。
   `node scripts/guard-mp-style-selectors.mjs --dist dist/build/mp-weixin` ⇒ `raw/11-before-dist-scan.txt`
   产物**命中 3**：`app.wxss` 两条 `*,*:before,*:after` + `pages/sales/create-sale.wxss` 一条 `.create-sale-page *.data-v-0925e575,…` ⇒ EXIT=1。
2. **修复后产物扫描（硬验收 2 前半）** ⇒ `raw/21-after-dist-scan.txt` 与 `raw/25-after-dist-scan-recheck.txt`（两次独立跑，防偶发）
   均为 `MP 产物通配 prelude（dist/build/mp-weixin）：命中 0 处` + `MP_STAR_GUARD_DIST_PASS` + `DIST_RECHECK_EXIT=0`。
3. **正对照（硬验收 2 后半）** `node docs/evidence/mobile-28f1/anti/20-positive-control-and-h5-preservation.mjs` ⇒ `raw/24-positive-control-and-h5-preservation.txt:1-4`
   把真实 `app.wxss` 复制到临时目录后追加 `.injected-positive-control-28f1 *{color:red}`，同一扫描器 ⇒ `注入后命中 = 1` 且点名该行 ⇒ `判定 = PASS（注入即被扫出 ⇒ 扫描器有分辨力，非恒绿）`。真实 `dist/` 未写入。
   守卫自检 ⇒ `raw/26-guard-self-test.txt`：`{"ok":true,"positiveHits":1,"negativeHits":0,"mediaInnerHits":1,"keyframeFalseHits":0,"atOnlyHits":0}` / `SELFTEST_EXIT=0`。
4. **H5 行为保留（硬验收 3）** ⇒ 同 `raw/24` 的 C 段 `:10-22`（扫 H5 CSS 119 个文件，逐规则解析）
   ① `全局 box-sizing 通配块：PRESENT ×6`，含 `assets/index-DpZdr1mN.css | *,*:before,*:after`；
   ② `@media (prefers-reduced-motion) 带 transition 降级：PRESENT → assets/create-sale-CSqN0HI9.css, assets/index-DpZdr1mN.css`；
   ③ `create-sale 页 .create-sale-page * 降级：PRESENT → assets/create-sale-CSqN0HI9.css`；
   ④ `uni-form display:block（同批 H5 修复）：PRESENT → assets/index-DpZdr1mN.css` ⇒ `判定 = PASS`。
   D 段 `:24-32`：源码 3 处通配全部 `✓ 已隔离`，且三条规则文本仍在（未删）。
5. **三端构建（硬验收 1）** ⇒ `raw/20/22/23-after-build-*.txt`
   `MP_BUILD_EXIT=0`、`H5_BUILD_EXIT=0`、`APP_BUILD_EXIT=0`，三份日志均含 `DONE  Build complete.`。
6. **门禁未回归** `npm run check:gates` ⇒ `raw/28-gates-check.txt` **`GATES_EXIT=0`**：`:10` type 0 条（基线 0）；`:17` lint error 0 / warning 12872（均等于基线）；`:52-53` **`Test Files 16 passed (16)` / `Tests 329 passed (329)`**；`:68-70` contract 差集 1 条具名豁免；`:86` guard A/B/C/D 全绿。
7. **微信 CLI（硬验收 4）** ⇒ `raw/29-wechat-cli-probe-not-run.txt`
   4 个常见安装路径 `Test-Path` 全 ABSENT；`where.exe cli.bat` / `wechatide` 未找到；`C|D:\Program Files\Tencent` 目录 ABSENT ⇒ **本机无微信开发者工具 CLI ⇒ preview 未执行**。

## 验收自评

| 硬验收（卡 §三） | 自评 | 依据 |
|:--|:--|:--|
| 1 三端构建 EXIT=0 | **通过** | 证据 5（三端 EXIT=0 + `DONE Build complete.`） |
| 2 MP 产物 `*` 通配 prelude = 0；正对照注入必红 | **通过** | 证据 2（0，两次复跑）+ 证据 3（注入命中 1 并点名；自检 `ok:true`） |
| 3 H5 原有 box-sizing / reduced-motion 行为仍保留 | **通过** | 证据 4（H5 产物四处 PRESENT）+ 源码 diff 仅加注释包裹 |
| 4 有微信 CLI 必须跑 preview；没有不得写"运行通过" | **按"无 CLI"处置 ⇒ 未验** | 证据 7 探测记录；本汇报**未写** preview 通过，仅写构建与静态扫描通过 |
| 5 未 push、未开 PR、逐文件 add、工作树 clean | **通过** | 17 个文件逐个 `git add`（无 `-A`、无目录级）；无 upstream；提交后 `git status --short` 为空 |

红线自查：未直接删除 H5 修复规则（证据 4-D）；未改 tabBar 结构或 AI 功能（本次仅样式注释包裹，未触碰 `custom-tab-bar` / `pages.json` / AI 相关代码）；未以构建 EXIT=0 替代微信运行态（已如实记 preview 未验）。

## 未完成与阻塞

1. **微信 preview 未在本机验证**（无 CLI，硬验收 4 走"如实记未验"分支）。⇒ 需在有开发者工具的机器上跑一次 `preview` 才能闭环"微信运行态"；或由凌舟在生产/预览环境补验。
2. **守卫未接入任何门禁**：只落了脚本 + 手动读数，**未加 `app-mobile/package.json` 的 npm script，也未接进 `check:gates` / CI**（`package.json` 不在我的代码面；且 29F3 裁定 3 对同类问题口径为"暂不阻断、待裁定"）。⇒ 请裁定是否接入（接入点建议：`check:gates` 末尾新增 `guard:mp-style`，产物扫描版需先构建，或用无需产物的 `--src` 模式）。
3. 阻塞：无（本单交付已完整）。

## 风险与自我报备

1. **守卫脚本位置超出我的代码面**：卡 §二.3 要求"补静态守卫/测试"但未给路径。我按仓内既有惯例放在 `app-mobile/scripts/guard-mp-style-selectors.mjs`（同目录已有 `guard-request-contract.mjs`、`s3-163-logout-uniqueness-guard.cjs`、`type-check-gate.mjs`）——但真相源给移动端 owner 的代码面是 `app-mobile/src/**`，`app-mobile/scripts/**` 严格说**在其外**。请裁定该文件归属（保留 / 移入 `src/` 旁 / 交苏然的门禁面）。
2. **我的扫描器一度有 3 个真实缺陷，全靠自检与正对照暴露**（如实报备，说明"正对照必红"这条判据的价值）：① 嵌套块把外层选择器重复计入内层 ⇒ 干净样本假红；② 行号取"上一个 `}` 之后"而非 prelude 首个实字符 ⇒ 报告行号偏 5 行（曾报 `App.vue:62`，真实 67）；③ 自检的阴性夹具我自己写错（样本里本就含 `*`）。三者都已修正并留在 `--self-test` 里（`negativeHits=0` / `keyframeFalseHits=0` / `mediaInnerHits=1`）。修正后源码报告行号与文件真实行号**已逐条对齐**（见 `raw/10` 与 `raw/27`）。
3. **MP 侧行为影响是推断，不是本单实测**：卡 §一既有事实（微信对该文件报 `unexpected token '*'`、仓库外替换 token 后得 `✔ preview`）意味着这些规则在 MP 从未生效 ⇒ 隔掉不产生"失去有效样式"。但本单无 CLI，**未能本机复现 preview** 坐实这一点，故该结论标为"引用 + 推断"。
4. **取证过程中出现过两类假读数，均已重跑并覆盖**：① `.cmd` 批处理里 `%ERRORLEVEL%` 未展开 ⇒ 首批三端构建日志的退出码行为空，后用 `cmd /v:on` 延迟展开 + PowerShell 原生重定向重跑，才拿到 `MP/H5/APP_BUILD_EXIT=0`；② `check:gates` 第一次输出因文件被占用只剩 `GATES_EXIT=0` 一行，已重跑覆盖为完整 87 行（含 16/329）。⇒ 若凌舟复核到与我先前消息不一致的数字，以**已提交的 `raw/20/22/23/28` 为准**。
5. **本仓 PowerShell 环境故障仍在**（Core 内置模块缺失：`Set-Location`/`Test-Path`/`Set-Content`/`Select-Object` 等间歇不可用；且 `cmd /c` 内的 `cd /d` 不改变外层 PowerShell 当前目录，导致我三条守卫命令曾写到会话默认目录并因路径不存在失败）。本轮已全程规避，但建议排查，否则同端后续取证都会受影响。
6. 临时件已清：工作树内无 `_tmp-peek.mjs`/`_msg.txt` 类残留，提交前仓库外的控制脚本仍在 `D:\Users\ZXQL\m28f1-*`（未入库，避免污染 git）。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-MOBILE-28F1-阿潵回传.md`
关联卡：`docs/tasks/inbox/MOBILE-28F1-mp-star-selectors.md`
